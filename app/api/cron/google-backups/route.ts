import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

import { connectDB } from "@/lib/db";
import { Item } from "@/lib/models";
import { GoogleConnection } from "@/lib/models";
import { getGoogleClient } from "@/lib/google-tokens";
import { uploadStoredFile } from "@/lib/sftp";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.GOOGLE_BACKUP_CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await connectDB();

  const items = await Item.find({
    storageProvider: "google",
    googleFileId: { $exists: true, $nin: ["", null] },
    googleResourceType: { $in: ["document", "spreadsheet"] },
    trashed: false,
  })
    .select(
      "_id owner name googleFileId googleResourceType backupSourceModifiedTime backupStatus",
    )
    .sort({ lastSyncedAt: 1 })
    .limit(50)
    .lean();

  const results = {
    checked: 0,
    backedUp: 0,
    unchanged: 0,
    failed: 0,
    skipped: 0,
    details: [] as Array<{
      id: string;
      name: string;
      status: string;
      message?: string;
    }>,
  };

  const clientCache = new Map<
    string,
    Awaited<ReturnType<typeof getGoogleClient>>
  >();

  for (const item of items) {
    results.checked++;

    const itemId = String(item._id);
    const ownerId = String(item.owner);
    const itemName = item.name || "Untitled";

    try {
      let client = clientCache.get(ownerId);

      if (!client) {
        const connection = await GoogleConnection.exists({
          user: item.owner,
        });

        if (!connection) {
          results.skipped++;
          results.details.push({
            id: itemId,
            name: itemName,
            status: "skipped",
            message: "Employee has not connected Google.",
          });
          continue;
        }

        client = await getGoogleClient(ownerId);
        clientCache.set(ownerId, client);
      }

      const drive = google.drive({
        version: "v3",
        auth: client,
      });

      const metadata = await drive.files.get({
        fileId: item.googleFileId,
        fields: "id,name,mimeType,modifiedTime,webViewLink,trashed",
      });

      if (metadata.data.trashed) {
        results.skipped++;
        results.details.push({
          id: itemId,
          name: itemName,
          status: "skipped",
          message: "Google original is in the trash.",
        });
        continue;
      }

      if (!metadata.data.modifiedTime) {
        throw new Error("Google did not return a modification time.");
      }

      const sourceModifiedTime = new Date(metadata.data.modifiedTime);

      if (
        item.backupSourceModifiedTime &&
        new Date(item.backupSourceModifiedTime).getTime() >=
          sourceModifiedTime.getTime()
      ) {
        results.unchanged++;
        results.details.push({
          id: itemId,
          name: itemName,
          status: "unchanged",
        });
        continue;
      }

      const isDocument = item.googleResourceType === "document";

      const format = isDocument ? "docx" : "xlsx";

      const exportMimeType = isDocument
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      await Item.updateOne(
        { _id: item._id },
        {
          $set: {
            backupStatus: "pending",
            lastSyncError: "",
          },
        },
      );

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

      if (!buffer.length) {
        throw new Error("Google returned an empty export.");
      }

      const storedSize = await uploadStoredFile(itemId, buffer);

      if (storedSize !== buffer.length) {
        throw new Error("VPS backup size verification failed.");
      }

      const updates = {
        name: metadata.data.name || itemName,
        googleWebViewLink: metadata.data.webViewLink || "",
        size: storedSize,
        uploaded: storedSize,
        backupStatus: "synced",
        backupMimeType: exportMimeType,
        backupFormat: format,
        lastSyncedAt: new Date(),
        googleModifiedTime: sourceModifiedTime,
        backupSourceModifiedTime: sourceModifiedTime,
        lastSyncError: "",
      };

      await Item.updateOne({ _id: item._id }, { $set: updates });

      results.backedUp++;
      results.details.push({
        id: itemId,
        name: updates.name,
        status: "backed_up",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 1000)
          : "Unknown backup error.";

      console.error(`Automatic Google backup failed for ${itemId}:`, error);

      await Item.updateOne(
        { _id: item._id },
        {
          $set: {
            backupStatus: "failed",
            lastSyncError: message,
          },
        },
      );

      results.failed++;
      results.details.push({
        id: itemId,
        name: itemName,
        status: "failed",
        message,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    message: "Automatic Google backup check completed.",
    ...results,
  });
}
