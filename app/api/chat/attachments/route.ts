import { guard, J } from "@/lib/http";
import { Item } from "@/lib/models";
import { canAccessChannel } from "@/lib/chat-access";
import { QUOTA } from "@/lib/config";

/* ==========================================================================
   GET   -> { allowUpload }  whether sending files from the computer is on
   POST  { channel, name, size, mime }
         Creates a hidden, PROTECTED Drive item for one chat attachment. The
         browser then uploads it in chunks with  PUT /api/files/<id>.

   Optional switch in .env.local:  CHAT_ALLOW_PC_UPLOAD=false
   turns off "Upload from computer" (Drive files can still be attached).
   ========================================================================== */
const MAX_BYTES = Number(process.env.CHAT_MAX_FILE_BYTES || 500e6);
const allowUpload = () => process.env.CHAT_ALLOW_PC_UPLOAD !== "false";

export const GET = guard(async () => J({ allowUpload: allowUpload(), maxBytes: MAX_BYTES }));

export const POST = guard(async (req, s) => {
  if (!allowUpload()) throw new Error("Uploading from the computer is turned off. Attach a file from Drive instead.");

  const b = await req.json();
  const channel = String(b.channel || "");
  const name = String(b.name || "").trim();
  const size = Number(b.size);

  if (!(await canAccessChannel(channel, s.sub))) throw new Error("No access to this chat.");
  if (!name || name.length > 255) throw new Error("Invalid file name.");
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error("Empty files cannot be attached.");
  if (size > MAX_BYTES) throw new Error(`Files in chat can be at most ${Math.round(MAX_BYTES / 1e6)} MB.`);

  const used = (await Item.aggregate([{ $group: { _id: null, t: { $sum: "$size" } } }]))[0]?.t || 0;
  if (used + size > QUOTA) throw new Error("Storage quota reached. Ask an admin.");

  const item = await Item.create({
    name, type: "file", parent: null, owner: s.sub, size, uploaded: 0,
    mime: String(b.mime || "application/octet-stream"),
    storageProvider: "local", trashed: false, chatAttachment: true,
  });

  return J({ _id: item._id, name: item.name, size: item.size }, 201);
});
