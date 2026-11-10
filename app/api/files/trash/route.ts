import { guard, J } from "@/lib/http";
import { Item } from "@/lib/models";
import { purgeItem } from "@/lib/drive-purge";

export const runtime = "nodejs";

/* ==========================================================================
   DELETE /api/files/trash   -> Empty trash (permanent, only YOUR trash)
   PATCH  /api/files/trash   -> { restore: true } restore everything in trash
   ========================================================================== */
export const DELETE = guard(async (_req, s) => {
  const top: any[] = await Item.find({
    owner: s.sub,
    trashed: true,
    chatAttachment: { $ne: true },
  });

  let deleted = 0;
  const failed: string[] = [];

  for (const entry of top) {
    // A folder deleted earlier in this loop may already have removed this one.
    const item = await Item.findById(entry._id);
    if (!item) continue;

    try {
      await purgeItem(item, { sub: s.sub, name: s.name });
      deleted += 1;
    } catch (error: any) {
      failed.push(`${entry.name}: ${error?.message || "could not be deleted"}`);
    }
  }

  return J({ ok: failed.length === 0, deleted, failed });
});

export const PATCH = guard(async (req, s) => {
  const body = await req.json().catch(() => ({}));
  if (!body.restore) throw new Error("Nothing to do.");

  const result = await Item.updateMany(
    { owner: s.sub, trashed: true, chatAttachment: { $ne: true } },
    { $set: { trashed: false } },
  );

  return J({ ok: true, restored: result.modifiedCount || 0 });
});
