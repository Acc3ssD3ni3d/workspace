import { google } from "googleapis";

import { guard, J } from "@/lib/http";
import { Item } from "@/lib/models";
import { load } from "@/lib/perm";
import { getGoogleClient } from "@/lib/google-tokens";
import { uploadStoredFile } from "@/lib/sftp";

export const runtime = "nodejs";

export const POST = guard(async (_req, session, { params }) => {
  const item = await load(Item, params.id, session, "edit");

  if (!item.googleFileId) {
    throw new Error("This item is not linked to a Google file.");
  }

  const resourceType = item.googleResourceType;

  if (resourceType !== "document" && resourceType !== "spreadsheet") {
    throw new Error("Only Google Docs and Sheets can be synchronized.");
  }

  const format = resourceType === "document" ? "docx" : "xlsx";

  const exportMimeType =
    resourceType === "document"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  try {
    item.backupStatus = "pending";
    item.lastSyncError = "";
    await item.save();

    const client = await getGoogleClient(session.sub);

    const drive = google.drive({
      version: "v3",
      auth: client,
    });

    // Capture Google metadata before exporting.
    const metadata = await drive.files.get({
      fileId: item.googleFileId,
      fields: "id,name,mimeType,modifiedTime,webViewLink",
    });

    if (!metadata.data.modifiedTime) {
      throw new Error("Google did not return the file modification time.");
    }

    const sourceModifiedTime = new Date(metadata.data.modifiedTime);

    // Export the current Google document or spreadsheet.
    const exported = await drive.files.export(
      {
        fileId: item.googleFileId,
        mimeType: exportMimeType,
      },
      {
        responseType: "arraybuffer",
      },
    );

    const buffer = Buffer.from(exported.data as ArrayBuffer);

    if (buffer.length === 0) {
      throw new Error("Google returned an empty export.");
    }

    // Save the exported file independently on the EduOne VPS.
    const storedSize = await uploadStoredFile(String(item._id), buffer);

    if (storedSize !== buffer.length) {
      throw new Error("VPS backup size verification failed.");
    }

    item.name = metadata.data.name || item.name;

    if (metadata.data.webViewLink) {
      item.googleWebViewLink = metadata.data.webViewLink;
    }

    item.size = storedSize;
    item.uploaded = storedSize;

    item.backupStatus = "synced";
    item.backupMimeType = exportMimeType;
    item.backupFormat = format;

    item.lastSyncedAt = new Date();
    item.googleModifiedTime = sourceModifiedTime;
    item.backupSourceModifiedTime = sourceModifiedTime;

    item.lastSyncError = "";

    await item.save();

    return J({
      ok: true,
      message: "Google file backed up successfully.",
      backup: {
        name: item.name,
        format: item.backupFormat,
        size: item.size,
        status: item.backupStatus,
        lastSyncedAt: item.lastSyncedAt,
        googleModifiedTime: item.googleModifiedTime,
        backupSourceModifiedTime: item.backupSourceModifiedTime,
      },
    });
  } catch (error) {
    console.error("Google file synchronization failed:", error);

    const message =
      error instanceof Error
        ? error.message.slice(0, 1000)
        : "Unknown synchronization error.";

    await Item.updateOne(
      { _id: item._id },
      {
        $set: {
          backupStatus: "failed",
          lastSyncError: message,
        },
      },
    );

    throw new Error(`Google backup synchronization failed: ${message}`);
  }
});
