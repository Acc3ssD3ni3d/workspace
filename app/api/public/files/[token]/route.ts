import { createHash } from "crypto";
import { Readable } from "stream";
import { Item, FileActivity } from "@/lib/models";
import { createStoredFileReadStream } from "@/lib/sftp";

export const GET = async (
  req: Request,
  { params }: { params: { token: string } },
) => {
  try {
    const token = params.token;

    // Validate the token format.
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return Response.json(
        { error: "Invalid or expired sharing link." },
        { status: 404 },
      );
    }

    // Hash the supplied token before looking it up.
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const item = await Item.findOne({
      "linkAccess.enabled": true,
      "linkAccess.tokenHash": tokenHash,
      type: "file",
      trashed: false,
    }).select("+linkAccess.tokenHash");

    if (!item) {
      return Response.json(
        { error: "Invalid or expired sharing link." },
        { status: 404 },
      );
    }

    // Check link expiration.
    const expiresAt = item.linkAccess?.expiresAt;

    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      return Response.json(
        { error: "This sharing link has expired." },
        { status: 410 },
      );
    }

    if (item.uploaded < item.size) {
      return Response.json(
        { error: "File upload is not complete." },
        { status: 409 },
      );
    }

    const size = item.size;
    let start = 0;
    let end = size - 1;
    let status = 200;

    // HTTP Range support for previews and media.
    const range = req.headers.get("range") || "";
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);

    if (match && (match[1] || match[2]) && size > 0) {
      if (match[1]) {
        start = Number(match[1]);

        if (match[2]) {
          end = Math.min(Number(match[2]), end);
        }
      } else {
        const suffixLength = Number(match[2]);

        if (suffixLength <= 0) {
          return new Response(null, {
            status: 416,
            headers: {
              "Content-Range": `bytes */${size}`,
            },
          });
        }

        start = Math.max(0, size - suffixLength);
      }

      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        start > end ||
        start >= size
      ) {
        return new Response(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${size}`,
          },
        });
      }

      status = 206;
    }

    const mime = item.mime || "application/octet-stream";

    const inline =
      (/^(video|audio|image)\//.test(mime) && !/svg/i.test(mime)) ||
      mime === "application/pdf";

    const downloadRequested = new URL(req.url).searchParams.get("dl") === "1";

    const attach = downloadRequested || !inline;

    const stream = size
      ? await createStoredFileReadStream(String(item._id), start, end)
      : null;

    const body = stream ? (Readable.toWeb(stream) as ReadableStream) : null;

    // Record successful link access.
    if (status === 200 || start === 0) {
      await FileActivity.create({
        item: item._id,
        actor: null,
        actorName: "Anyone with link",
        actorEmail: "",
        action: attach ? "download" : "view",
        accessMethod: "link",
        details: attach
          ? "Downloaded through sharing link"
          : "Viewed through sharing link",
      }).catch((error) => {
        console.error("Public file activity logging failed:", error);
      });

      if (!attach) {
        await Item.updateOne(
          { _id: item._id },
          {
            $set: { lastAccessedAt: new Date() },
            $inc: { accessCount: 1 },
          },
        ).catch(() => {});
      }
    }

    return new Response(body, {
      status,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(size ? end - start + 1 : 0),
        "Accept-Ranges": "bytes",
        ...(status === 206
          ? {
              "Content-Range": `bytes ${start}-${end}/${size}`,
            }
          : {}),
        "Content-Disposition": `${attach ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(item.name || "download")}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    console.error("Public file access error:", error);

    return Response.json(
      { error: "Unable to access this file." },
      { status: 500 },
    );
  }
};
