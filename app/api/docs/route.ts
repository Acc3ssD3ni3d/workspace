import { google } from "googleapis";

import { guard, J } from "@/lib/http";
import { Item } from "@/lib/models";
import { getGoogleClient } from "@/lib/google-tokens";

export const runtime = "nodejs";

const DOC_MIME = "application/x-workspace-doc";
const SHEET_MIME = "application/x-workspace-sheet";

async function getDocsFolder(owner: string) {
  let folder = await Item.findOne({
    owner,
    type: "folder",
    name: "Docs",
    parent: null,
    trashed: false,
  });

  if (!folder) {
    folder = await Item.create({
      name: "Docs",
      type: "folder",
      parent: null,
      owner,
      size: 0,
      uploaded: 0,
      storageProvider: "local",
      trashed: false,
    });
  }

  return folder;
}

// ------------------------------------
// LIST GOOGLE DOCS / SHEETS
// ------------------------------------

export const GET = guard(async (req, session) => {
  const kind = new URL(req.url).searchParams.get("kind");

  if (kind !== "doc" && kind !== "sheet") {
    throw new Error("Invalid document type.");
  }

  const folder = await getDocsFolder(session.sub);
  const mime = kind === "doc" ? DOC_MIME : SHEET_MIME;

  let items = await Item.find({
    owner: session.sub,
    parent: folder._id,
    type: "file",
    mime,
    trashed: false,
  })
    .select(
      "_id name updatedAt googleFileId googleWebViewLink googleModifiedTime backupStatus backupFormat backupMimeType lastSyncedAt lastSyncError",
    )
    .sort({ updatedAt: -1 })
    .lean();

  // Serve cached MongoDB metadata here. Do not make one Google API request
  // per document during page rendering; that serial network work caused slow loads.
  // Metadata synchronization remains available through the explicit sync endpoints.

  return J(
    items.map((item) => ({
      _id: String(item._id),
      title: item.name,
      updatedAt: item.googleModifiedTime || item.updatedAt,
      updatedBy: "",
      googleFileId: item.googleFileId,
      googleWebViewLink: item.googleWebViewLink,
      backupStatus: item.backupStatus || "not_started",
      backupFormat: item.backupFormat || "",
      lastSyncedAt: item.lastSyncedAt || null,
      googleModifiedTime: item.googleModifiedTime || null,
      lastSyncError: item.lastSyncError || "",
    })),
  );
});

// ------------------------------------
// CREATE GOOGLE DOC / SPREADSHEET
// ------------------------------------

export const POST = guard(async (req, session) => {
  const body = await req.json();

  const kind = body.kind === "sheet" ? "sheet" : "doc";

  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : kind === "doc"
        ? "Untitled document"
        : "Untitled spreadsheet";

  const client = await getGoogleClient(session.sub);
  const folder = await getDocsFolder(session.sub);

  let googleFileId = "";
  let googleWebViewLink = "";

  if (kind === "doc") {
    const docs = google.docs({
      version: "v1",
      auth: client,
    });

    const result = await docs.documents.create({
      requestBody: { title },
    });

    googleFileId = result.data.documentId || "";

    if (!googleFileId) {
      throw new Error("Google Docs did not return a document ID.");
    }

    googleWebViewLink = `https://docs.google.com/document/d/${googleFileId}/edit`;
  } else {
    const sheets = google.sheets({
      version: "v4",
      auth: client,
    });

    const result = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
      },
    });

    googleFileId = result.data.spreadsheetId || "";

    if (!googleFileId) {
      throw new Error("Google Sheets did not return a spreadsheet ID.");
    }

    googleWebViewLink = `https://docs.google.com/spreadsheets/d/${googleFileId}/edit`;
  }

  try {
    const item = await Item.create({
      name: title,
      type: "file",
      parent: folder._id,
      owner: session.sub,
      size: 0,
      uploaded: 0,
      mime: kind === "doc" ? DOC_MIME : SHEET_MIME,
      storageProvider: "google",
      googleFileId,
      googleWebViewLink,
      googleResourceType: kind === "doc" ? "document" : "spreadsheet",
      backupStatus: "not_started",
      backupFormat: "",
      backupMimeType: "",
      lastSyncedAt: null,
      googleModifiedTime: null,
      lastSyncError: "",
      trashed: false,
      shared: [],
      org: "none",
    });

    return J(
      {
        _id: String(item._id),
        title: item.name,
        googleFileId,
        googleWebViewLink,
        backupStatus: item.backupStatus,
      },
      201,
    );
  } catch (error) {
    try {
      const drive = google.drive({
        version: "v3",
        auth: client,
      });

      await drive.files.delete({
        fileId: googleFileId,
      });
    } catch (cleanupError) {
      console.error("Google file cleanup failed:", cleanupError);
    }

    throw error;
  }
});
