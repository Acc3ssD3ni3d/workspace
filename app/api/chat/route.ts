import { guard, J } from "@/lib/http";
import { ChatGroup, Item, Message } from "@/lib/models";
import { roleOf } from "@/lib/perm";
import { canAccessChannel, channelRecipients } from "@/lib/chat-access";
import { notifyUsers } from "@/lib/notify";
import { deleteStoredFile } from "@/lib/sftp";

export const runtime = "nodejs";

/* ==========================================================================
   channel = "general" | "dm:<idA>:<idB>" | "group:<groupId>"

   Attachments (max 10 per message):
   { id, source: "drive" }   an existing Drive file the sender can open
   { id, source: "upload" }  a file sent from the computer. It is PROTECTED:
                             hidden from Drive, only chat members can open it,
                             no sharing links, removed when the message is deleted.
   ========================================================================== */
const MAX_ATTACHMENTS = 10;

type Ref = { id: string; source: "upload" | "drive" };

const parseRefs = (value: unknown): Ref[] =>
  (Array.isArray(value) ? value : [])
    .slice(0, MAX_ATTACHMENTS)
    .map((entry: any) =>
      typeof entry === "string"
        ? { id: entry, source: "upload" as const }
        : { id: String(entry?.id || ""), source: entry?.source === "drive" ? ("drive" as const) : ("upload" as const) },
    )
    .filter((ref) => /^[a-f0-9]{24}$/i.test(ref.id));

/* ---------- GET ---------- */
export const GET = guard(async (req, s) => {
  const u = new URL(req.url);
  const channel = u.searchParams.get("channel") || "general";
  const after = u.searchParams.get("after");

  if (!(await canAccessChannel(channel, s.sub))) throw new Error("No access");

  return J(
    await Message.find({
      channel,
      ...(after ? { createdAt: { $gt: new Date(after) } } : {}),
    })
      .sort({ createdAt: 1 })
      .limit(200),
  );
});

/* ---------- POST ---------- */
export const POST = guard(async (req, s) => {
  const body = await req.json();
  const channel = String(body.channel || "");
  const text = String(body.text || "").trim();
  const refs = parseRefs(body.attachments);

  if (!(await canAccessChannel(channel, s.sub))) throw new Error("Invalid message");
  if (!text && !refs.length) throw new Error("Write a message or attach a file.");

  const attachments: { item: any; name: string; mime: string; size: number; source: string }[] = [];

  // Protected uploads from the computer.
  const uploadIds = refs.filter((r) => r.source === "upload").map((r) => r.id);
  if (uploadIds.length) {
    const items: any[] = await Item.find({ _id: { $in: uploadIds }, owner: s.sub, chatAttachment: true }).lean();
    if (items.length !== uploadIds.length) throw new Error("An attachment could not be found.");
    if (items.some((item) => item.uploaded < item.size)) throw new Error("Wait for the upload to finish.");
    items.forEach((item) =>
      attachments.push({ item: item._id, name: item.name, mime: item.mime || "application/octet-stream", size: item.size, source: "upload" }),
    );
  }

  // Existing Drive files: the sender must be able to open them.
  const driveIds = refs.filter((r) => r.source === "drive").map((r) => r.id);
  if (driveIds.length) {
    const items: any[] = await Item.find({ _id: { $in: driveIds }, type: "file", trashed: false, chatAttachment: { $ne: true } });
    if (items.length !== driveIds.length) throw new Error("A Drive file could not be found.");

    for (const item of items) {
      if (item.storageProvider === "google" || item.googleFileId) {
        throw new Error(`"${item.name}" is a Google file. Share it from Google instead.`);
      }
      if (item.uploaded < item.size) throw new Error(`"${item.name}" is still uploading.`);
      if (!(await roleOf(item, s))) throw new Error(`You do not have access to "${item.name}".`);
      attachments.push({ item: item._id, name: item.name, mime: item.mime || "application/octet-stream", size: item.size, source: "drive" });
    }
  }

  const message = await Message.create({
    channel, from: s.sub, name: s.name, text: text.slice(0, 4000), attachments,
  });

  // Notify the other people in this chat (General is not notified: too noisy).
  const recipients = await channelRecipients(channel, s.sub);
  if (recipients.length) {
    let title = s.name;
    if (channel.startsWith("group:")) {
      const group: any = await ChatGroup.findById(channel.slice(6)).select("name").lean();
      title = group?.name || "Group chat";
    }
    const preview = text || `Sent ${attachments.length} attachment${attachments.length > 1 ? "s" : ""}`;
    await notifyUsers(recipients, {
      type: "chat",
      title,
      body: channel.startsWith("group:") ? `${s.name}: ${preview}` : preview,
      link: `/chat?channel=${encodeURIComponent(channel)}`,
      key: `chat:${channel}`,
    });
  }

  return J(message, 201);
});

/* ---------- DELETE  (unsend: only the sender) ---------- */
export const DELETE = guard(async (req, s) => {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new Error("Message ID is required.");

  const message: any = await Message.findById(id);
  if (!message) throw new Error("Message not found.");
  if (String(message.from) !== String(s.sub)) throw new Error("You can only delete your own messages.");

  // Protected uploads are erased from storage; Drive files are never touched.
  for (const attachment of message.attachments || []) {
    if (attachment.source === "drive") continue;
    try { await deleteStoredFile(String(attachment.item)); } catch (error) { console.error("Chat file removal failed:", error); }
    await Item.deleteOne({ _id: attachment.item, chatAttachment: true });
  }

  await Message.deleteOne({ _id: id });
  return J({ ok: true });
});
