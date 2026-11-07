import bcrypt from "bcryptjs";

import { guard, J } from "@/lib/http";
import { User } from "@/lib/models";

export const runtime = "nodejs";

export const PATCH = guard(async (req, session) => {
  const body = await req.json();

  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  const confirmPassword = String(body.confirmPassword || "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return J({ error: "All password fields are required." }, 400);
  }

  if (newPassword.length < 8) {
    return J(
      { error: "New password must contain at least 8 characters." },
      400,
    );
  }

  if (newPassword !== confirmPassword) {
    return J({ error: "New password and confirmation do not match." }, 400);
  }

  if (currentPassword === newPassword) {
    return J(
      { error: "New password must be different from your current password." },
      400,
    );
  }

  const user = await User.findOne({
    _id: session.sub,
    active: true,
  });

  if (!user) {
    return J({ error: "Account not found." }, 404);
  }

  const passwordMatches = await bcrypt.compare(
    currentPassword,
    user.passwordHash,
  );

  if (!passwordMatches) {
    return J({ error: "Your current password is incorrect." }, 400);
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);

  await user.save();

  return J({
    success: true,
    message: "Your password has been changed successfully.",
  });
});
