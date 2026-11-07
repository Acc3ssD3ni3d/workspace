import { NextResponse } from "next/server";

import { guard } from "@/lib/http";
import { Item } from "@/lib/models";
import { load } from "@/lib/perm";
import { getStoredFile } from "@/lib/sftp";

export const runtime = "nodejs";

export const GET = guard(async (_req, session, { params }) => {
  const item = await load(Item, params.id, session, "view");

  if (item.backupStatus !== "synced") {
    return NextResponse.json(
      { error: "No completed VPS backup is available for this file." },
      { status: 404 },
    );
  }

  if (!item.backupFormat) {
    return NextResponse.json(
      { error: "Backup format is unavailable." },
      { status: 404 },
    );
  }

  const buffer = await getStoredFile(String(item._id));

  if (!buffer || buffer.length === 0) {
    return NextResponse.json(
      { error: "The VPS backup file could not be found." },
      { status: 404 },
    );
  }

  const extension = item.backupFormat;
  const mimeType =
    item.backupMimeType ||
    (extension === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  const baseName =
    String(item.name || "backup")
      .replace(/\.[^/.]+$/, "")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .trim() || "backup";

  const filename = `${baseName}.${extension}`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
