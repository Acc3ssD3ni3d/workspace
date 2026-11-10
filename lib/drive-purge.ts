import "server-only";
import { google } from "googleapis";
import { FileActivity, Item } from "@/lib/models";
import { deleteStoredFile } from "@/lib/sftp";
import { getGoogleClient } from "@/lib/google-tokens";

/* ==========================================================================
   PERMANENT DELETE (used by "Empty trash")
   Removes a file or a whole folder tree:
   - VPS files are deleted from storage
   - Google Docs / Sheets are deleted from the owner's Google Drive
   - the Mongo records are removed
   ========================================================================== */
export async function purgeItem(item: any, actor: { sub: string; name: string }) {
  if (item.type === "folder") {
    const children = await Item.find({ parent: item._id });
    for (const child of children) await purgeItem(child, actor);
  } else if (item.storageProvider === "google" || item.googleFileId) {
    if (item.googleFileId) {
      const client = await getGoogleClient(String(item.owner));
      await google.drive({ version: "v3", auth: client }).files.delete({
        fileId: item.googleFileId,
      });
    }
  } else {
    await deleteStoredFile(String(item._id));
  }

  await FileActivity.create({
    item: item._id,
    actor: actor.sub,
    actorName: actor.name,
    action: "delete",
    accessMethod: "owner",
    details: `Permanently deleted ${item.name} (empty trash)`,
  });

  await item.deleteOne();
}
