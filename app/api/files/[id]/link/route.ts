import { createHash, randomBytes } from "crypto";
import { guard, J } from "@/lib/http";
import { Item, FileActivity } from "@/lib/models";
import { load } from "@/lib/perm";

// ------------------------------------
// GENERATE OR REGENERATE SHARE LINK
// ------------------------------------

export const POST = guard(async (req, s, { params }) => {
  const it = await load(Item, params.id, s, "owner");

  if (it.type !== "file") {
    throw new Error("Sharing links are available for files only.");
  }

  const body = await req.json().catch(() => ({}));

  const role = body.role === "edit" ? "edit" : "view";

  const expiryDays = body.expiryDays ?? null;

  if (
    expiryDays !== null &&
    (!Number.isInteger(expiryDays) || expiryDays < 1 || expiryDays > 365)
  ) {
    throw new Error("Expiry must be between 1 and 365 days.");
  }

  // Generate a cryptographically secure random token.
  const token = randomBytes(32).toString("hex");

  // Store only the token hash in MongoDB.
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const expiresAt =
    expiryDays === null
      ? null
      : new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  it.linkAccess = {
    enabled: true,
    tokenHash,
    role,
    expiresAt,
    createdAt: new Date(),
  };

  await it.save();

  await FileActivity.create({
    item: it._id,
    actor: s.sub,
    actorName: "File owner",
    action: "link_created",
    accessMethod: "owner",
    details: `Created ${role} sharing link`,
  });

  const origin = new URL(req.url).origin;

  return J({
    enabled: true,
    role,
    expiresAt,
    shareUrl: `${origin}/api/public/files/${token}`,
  });
});

// ------------------------------------
// REVOKE SHARE LINK
// ------------------------------------

export const DELETE = guard(async (_req, s, { params }) => {
  const it = await load(Item, params.id, s, "owner");

  if (!it.linkAccess?.enabled) {
    return J({
      ok: true,
      message: "No active sharing link.",
    });
  }

  it.linkAccess = {
    enabled: false,
    tokenHash: "",
    role: "view",
    expiresAt: null,
    createdAt: null,
  };

  await it.save();

  await FileActivity.create({
    item: it._id,
    actor: s.sub,
    actorName: "File owner",
    action: "link_revoked",
    accessMethod: "owner",
    details: "Sharing link revoked",
  });

  return J({
    ok: true,
    message: "Sharing link revoked successfully.",
  });
});
