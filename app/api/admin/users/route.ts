import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

import { guard, J } from "@/lib/http";
import { User } from "@/lib/models";
import { DOMAIN } from "@/lib/config";
import {
  createHostingerMailbox,
  deleteHostingerMailbox,
} from "@/lib/hostinger";
import { sendEmployeeInvitation } from "@/lib/email";

function generateTemporaryPassword(length = 16) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const special = "!@#$%*-_";
  const all = upper + lower + numbers + special;

  const chars = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    numbers[randomInt(numbers.length)],
    special[randomInt(special.length)],
  ];

  while (chars.length < length) {
    chars.push(all[randomInt(all.length)]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

function normalizeLocalPart(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isValidPersonalEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// GET: List all workspace users.
export const GET = guard(
  async () =>
    J(await User.find().select("-passwordHash").sort({ createdAt: 1 }).lean()),
  true,
);

// POST: Create mailbox, workspace account and invitation.
export const POST = guard(async (req) => {
  const body = await req.json();

  const name = String(body.name || "").trim();
  const local = normalizeLocalPart(body.local);
  const personalEmail = String(body.personalEmail || "")
    .trim()
    .toLowerCase();

  const role = body.role === "admin" ? "admin" : "member";

  if (!name) {
    throw new Error("Employee name is required.");
  }

  if (name.length > 120) {
    throw new Error("Employee name is too long.");
  }

  if (!/^[a-z0-9._-]{2,40}$/.test(local)) {
    throw new Error("Enter a valid company email username.");
  }

  if (!isValidPersonalEmail(personalEmail)) {
    throw new Error("Enter a valid personal email address.");
  }

  if (personalEmail.length > 254) {
    throw new Error("Personal email address is too long.");
  }

  const email = `${local}@${DOMAIN}`.toLowerCase();

  const existingUser = await User.findOne({ email }).lean();

  if (existingUser) {
    throw new Error("This company email already exists.");
  }

  const temporaryPassword = generateTemporaryPassword();

  // Create Hostinger mailbox first.
  const mailbox = await createHostingerMailbox(local, temporaryPassword);

  let user;

  try {
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    user = await User.create({
      name,
      email,
      personalEmail,
      passwordHash,
      role,
      active: true,
      mailboxId: String(mailbox.id),
      mailboxStatus: "active",
      invitationStatus: "pending",
      invitationSentAt: null,
    });
  } catch (error) {
    console.error(
      "Workspace account creation failed after mailbox creation:",
      error,
    );

    throw new Error(
      "The company mailbox was created, but the workspace account could not be created. Check Hostinger before retrying.",
    );
  }

  // Send invitation.
  // Login URL is now generated internally from APP_URL in lib/email.ts.
  try {
    await sendEmployeeInvitation({
      name,
      personalEmail,
      companyEmail: email,
      temporaryPassword,
    });

    await User.findByIdAndUpdate(user._id, {
      invitationStatus: "sent",
      invitationSentAt: new Date(),
    });

    return J(
      {
        ok: true,
        message: `Employee account, company mailbox and invitation created successfully for ${email}.`,
        id: user._id,
        email,
        personalEmail,
        mailboxStatus: "active",
        invitationStatus: "sent",
      },
      201,
    );
  } catch (error) {
    console.error("Employee invitation email failed:", error);

    await User.findByIdAndUpdate(user._id, {
      invitationStatus: "failed",
    });

    return J(
      {
        ok: true,
        message: `Account and mailbox were created for ${email}, but the invitation email failed. The invitation needs to be resent.`,
        id: user._id,
        email,
        personalEmail,
        mailboxStatus: "active",
        invitationStatus: "failed",
      },
      201,
    );
  }
}, true);

// PATCH: Update user role, account status or password.
export const PATCH = guard(async (req, session) => {
  const body = await req.json();
  const id = String(body.id || "").trim();

  if (!id) {
    throw new Error("User ID is required.");
  }

  const user = await User.findById(id);

  if (!user) {
    throw new Error("User not found.");
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.active === "boolean" && id !== String(session.sub)) {
    updates.active = body.active;
  }

  if (
    (body.role === "admin" || body.role === "member") &&
    id !== String(session.sub)
  ) {
    updates.role = body.role;
  }

  // Allows a member to edit the Organisation calendar.
  // Admins always can.
  if (typeof body.orgCalendarEditor === "boolean") {
    updates.orgCalendarEditor = body.orgCalendarEditor;
  }

  if (body.password !== undefined && body.password !== "") {
    const password = String(body.password);

    if (password.length < 8) {
      throw new Error("Password must contain at least 8 characters.");
    }

    if (password.length > 128) {
      throw new Error("Password is too long.");
    }

    updates.passwordHash = await bcrypt.hash(password, 12);
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No valid changes were provided.");
  }

  await User.findByIdAndUpdate(id, updates, {
    runValidators: true,
  });

  return J({
    ok: true,
    message: "User updated successfully.",
  });
}, true);

// DELETE: Delete Hostinger mailbox first, then workspace account.
export const DELETE = guard(async (req, session) => {
  const body = await req.json();
  const id = String(body.id || "").trim();

  if (!id) {
    throw new Error("User ID is required.");
  }

  if (id === String(session.sub)) {
    throw new Error("You cannot delete your own administrator account.");
  }

  const user = await User.findById(id);

  if (!user) {
    throw new Error("User not found.");
  }

  // Delete the mailbox first.
  // If this fails, preserve the workspace account.
  if (user.mailboxId) {
    try {
      await deleteHostingerMailbox(String(user.mailboxId));
    } catch (error) {
      console.error("Hostinger mailbox deletion failed:", error);

      throw new Error(
        "Hostinger could not delete this employee's mailbox. The workspace account has been kept. Please check Hostinger and try again.",
      );
    }
  }

  // Delete workspace account after Hostinger accepts deletion.
  try {
    await User.findByIdAndDelete(id);
  } catch (error) {
    console.error(
      "Workspace account deletion failed after Hostinger mailbox deletion:",
      error,
    );

    throw new Error(
      "The Hostinger mailbox deletion was accepted, but the workspace account could not be deleted. Contact the administrator.",
    );
  }

  return J({
    ok: true,
    message: `${user.email} and its company mailbox deletion were successfully requested.`,
  });
}, true);
