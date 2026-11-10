import { Readable } from "stream";
import { guard } from "@/lib/http";
import { Item, Message } from "@/lib/models";
import { canAccessChannel } from "@/lib/chat-access";
import { createStoredFileReadStream } from "@/lib/sftp";

export const runtime = "nodejs";

/* ==========================================================================
   GET /api/chat/attachments/<itemId>[?dl=1]
   Only members of the chat the file was sent in can open it.
   ========================================================================== */
export const GET = guard(async (req, s, { params }) => {
  // Access comes from the CHAT: anybody in a conversation that contains the
  // file can open it (a Drive file may have been sent in several chats).
  const messages: any[] = await Message.find({ "attachments.item": params.id })
    .select("channel attachments")
    .limit(50)
    .lean();

  let attachment: any = null;
  for (const message of messages) {
    if (await canAccessChannel(message.channel, s.sub)) {
      attachment = (message.attachments || []).find(
        (a: any) => String(a.item) === String(params.id),
      );
      if (attachment) break;
    }
  }

  if (!attachment) return new Response("Not found", { status: 404 });

  const item: any = await Item.findById(params.id).lean();
  if (!item || item.uploaded < item.size) return new Response("Not found", { status: 404 });

  // Protected uploads must still be flagged; Drive files stop working once trashed.
  if (attachment.source === "drive" ? item.trashed : !item.chatAttachment) {
    return new Response("Not found", { status: 404 });
  }

  const size = item.size;
  let start = 0;
  let end = size - 1;
  let status = 200;

  const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
  if (match && (match[1] || match[2]) && size > 0) {
    if (match[1]) {
      start = Number(match[1]);
      if (match[2]) end = Math.min(Number(match[2]), end);
    } else {
      start = Math.max(0, size - Number(match[2]));
    }
    if (!Number.isSafeInteger(start) || start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    status = 206;
  }

  const mime = item.mime || "application/octet-stream";
  const inline =
    (/^(video|audio|image)\//.test(mime) && !/svg/i.test(mime)) || mime === "application/pdf";
  const attach = new URL(req.url).searchParams.get("dl") === "1" || !inline;

  const stream = await createStoredFileReadStream(params.id, start, end);

  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
      ...(status === 206 ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
      "Content-Disposition": `${attach ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(item.name || "download")}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
});
