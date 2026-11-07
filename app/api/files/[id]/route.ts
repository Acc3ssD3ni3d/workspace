import { Readable } from "stream";
import { google } from "googleapis";

import { guard, J } from "@/lib/http";
import { Item, User, FileActivity, GoogleConnection } from "@/lib/models";
import { load, roleOf } from "@/lib/perm";

import {
  uploadChunk,
  createStoredFileReadStream,
  deleteStoredFile,
} from "@/lib/sftp";

import { getGoogleClient } from "@/lib/google-tokens";

export const runtime = "nodejs";

type ActivityUser = {
  name?: string;
  email?: string;
} | null;

// ------------------------------------
// GOOGLE FILE HELPERS
// ------------------------------------

function isGoogleFile(item: any) {
  return item.storageProvider === "google" || Boolean(item.googleFileId);
}

function getGoogleFileUrl(item: any) {
  if (item.googleWebViewLink) {
    return item.googleWebViewLink;
  }

  if (item.googleResourceType === "document" && item.googleFileId) {
    return `https://docs.google.com/document/d/${item.googleFileId}/edit`;
  }

  if (item.googleResourceType === "spreadsheet" && item.googleFileId) {
    return `https://docs.google.com/spreadsheets/d/${item.googleFileId}/edit`;
  }

  return "";
}

async function getGoogleDrive(userId: string) {
  const client = await getGoogleClient(userId);

  return google.drive({
    version: "v3",
    auth: client,
  });
}

// ------------------------------------
// GOOGLE ORGANISATION ACCESS
// ------------------------------------

async function syncGoogleOrganisationAccess(
  item: any,
  ownerId: string,
  org: "none" | "view" | "edit",
) {
  if (!item.googleFileId) {
    throw new Error(
      "Google file ID is missing. Cannot update Google permissions.",
    );
  }

  // Use the file owner's connected Google account.
  const drive = await getGoogleDrive(ownerId);

  const tracked: Array<{
    user: any;
    email: string;
    permissionId: string;
  }> = Array.isArray(item.googleOrgPermissions)
    ? item.googleOrgPermissions
    : [];

  // PRIVATE: remove only permissions EduOne created.
  if (org === "none") {
    for (const permission of tracked) {
      try {
        await drive.permissions.delete({
          fileId: item.googleFileId,
          permissionId: permission.permissionId,
        });
      } catch (error: any) {
        const status = Number(error?.code || error?.response?.status);

        // Already deleted in Google.
        if (status !== 404) {
          throw new Error(
            `Could not remove EduOne organisation access for ${
              permission.email || "an employee"
            }. ${error?.message || "Google Drive error."}`,
          );
        }
      }
    }

    item.googleOrgPermissions = [];
    return;
  }

  // Get every active employee except the file owner.
  const activeUsers = await User.find({
    active: true,
    _id: { $ne: ownerId },
  })
    .select("_id")
    .lean();

  const activeIds = activeUsers.map((user: any) => String(user._id));

  const activeIdSet = new Set(activeIds);

  // Get employees who have connected their individual Google accounts.
  const connections = activeIds.length
    ? await GoogleConnection.find({
        user: { $in: activeIds },
      })
        .select("user email")
        .lean()
    : [];

  const connectionByUser = new Map(
    connections.map((connection: any) => [String(connection.user), connection]),
  );

  const connectedUserIds = new Set(
    connections.map((connection: any) => String(connection.user)),
  );

  const targetByEmail = new Map<string, { user: string; email: string }>();

  // IMPORTANT:
  // Skip employees who have not connected Google.
  // Do not block Public (EduOne) because of missing connections.
  for (const user of activeUsers as any[]) {
    const userId = String(user._id);
    const connection: any = connectionByUser.get(userId);

    if (!connection) {
      continue;
    }

    const email = String(connection.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      continue;
    }

    // Avoid duplicate Google permission requests.
    if (!targetByEmail.has(email)) {
      targetByEmail.set(email, {
        user: userId,
        email,
      });
    }
  }

  // Read existing permissions from Google.
  const existingByEmail = new Map<string, any>();

  let pageToken: string | undefined;

  do {
    const response = await drive.permissions.list({
      fileId: item.googleFileId,
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      fields: "nextPageToken,permissions(id,type,emailAddress,role)",
    });

    for (const permission of response.data.permissions || []) {
      const email = String(permission.emailAddress || "")
        .trim()
        .toLowerCase();

      if (email) {
        existingByEmail.set(email, permission);
      }
    }

    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  const previousByEmail = new Map(
    tracked.map((permission) => [
      String(permission.email || "").toLowerCase(),
      permission,
    ]),
  );

  const nextTracked: Array<{
    user: string;
    email: string;
    permissionId: string;
  }> = [];

  const desiredRole = org === "edit" ? "writer" : "reader";

  const createdPermissionIds: string[] = [];

  try {
    // Grant access to connected active employees.
    for (const target of targetByEmail.values()) {
      const previous = previousByEmail.get(target.email);
      const existing = existingByEmail.get(target.email);

      // Permission was previously created by EduOne.
      if (previous && existing?.id === previous.permissionId) {
        if (existing.role !== desiredRole) {
          await drive.permissions.update({
            fileId: item.googleFileId,
            permissionId: previous.permissionId,
            requestBody: {
              role: desiredRole,
            },
            fields: "id,role",
          });
        }

        nextTracked.push({
          ...target,
          permissionId: previous.permissionId,
        });

        continue;
      }

      // A permission already exists, but EduOne did not create it.
      // Preserve it and do not add it to our managed permission list.
      if (existing) {
        continue;
      }

      // Create the organisation permission.
      const created = await drive.permissions.create({
        fileId: item.googleFileId,
        requestBody: {
          type: "user",
          role: desiredRole,
          emailAddress: target.email,
        },
        sendNotificationEmail: false,
        supportsAllDrives: true,
        fields: "id",
      });

      const permissionId = created.data.id;

      if (!permissionId) {
        throw new Error(
          `Google did not return a permission ID for ${target.email}.`,
        );
      }

      createdPermissionIds.push(permissionId);

      nextTracked.push({
        ...target,
        permissionId,
      });
    }

    // Preserve existing EduOne permissions for active employees
    // who have disconnected Google. They are skipped, not revoked.
    for (const previous of tracked) {
      const previousUserId = String(previous.user);
      const previousEmail = String(previous.email || "").toLowerCase();

      const stillTargeted = targetByEmail.has(previousEmail);

      if (stillTargeted) {
        continue;
      }

      const employeeStillActive = activeIdSet.has(previousUserId);
      const employeeDisconnected =
        employeeStillActive && !connectedUserIds.has(previousUserId);

      if (employeeDisconnected) {
        nextTracked.push({
          user: previousUserId,
          email: previous.email,
          permissionId: previous.permissionId,
        });

        continue;
      }

      // Remove EduOne-managed access for employees who are no longer
      // active, or whose connected Google email has changed.
      try {
        await drive.permissions.delete({
          fileId: item.googleFileId,
          permissionId: previous.permissionId,
        });
      } catch (error: any) {
        const status = Number(error?.code || error?.response?.status);

        if (status !== 404) {
          throw error;
        }
      }
    }
  } catch (error: any) {
    // Roll back permissions created in this request if granting access fails.
    for (const permissionId of createdPermissionIds) {
      try {
        await drive.permissions.delete({
          fileId: item.googleFileId,
          permissionId,
        });
      } catch (rollbackError) {
        console.error("Google permission rollback failed:", rollbackError);
      }
    }

    throw new Error(
      error?.message || "Unable to update Google organisation permissions.",
    );
  }

  item.googleOrgPermissions = nextTracked;
}

// ------------------------------------
// ACTIVITY LOGGER
// ------------------------------------

async function logActivity(
  item: any,
  session: any,
  action:
    | "view"
    | "download"
    | "upload"
    | "edit"
    | "rename"
    | "share"
    | "unshare"
    | "delete"
    | "restore",
  details = "",
  accessMethod?: "owner" | "direct" | "organisation",
) {
  try {
    const user = (await User.findById(session.sub)
      .select("name email")
      .lean()) as ActivityUser;

    const permission = await roleOf(item, session);

    const method =
      accessMethod ||
      (permission === "owner"
        ? "owner"
        : item.shared?.some(
              (entry: any) => String(entry.user) === String(session.sub),
            )
          ? "direct"
          : "organisation");

    await FileActivity.create({
      item: item._id,
      actor: session.sub,
      actorName: user?.name || "Unknown user",
      actorEmail: user?.email || "",
      action,
      accessMethod: method,
      details,
    });

    if (action === "view") {
      await Item.updateOne(
        { _id: item._id },
        {
          $set: {
            lastAccessedAt: new Date(),
          },
          $inc: {
            accessCount: 1,
          },
        },
      );
    }
  } catch (error) {
    console.error("File activity logging failed:", error);
  }
}

// ------------------------------------
// RESUMABLE UPLOAD STATUS
// ------------------------------------

export const HEAD = guard(async (_r, s, { params }) => {
  const it = await load(Item, params.id, s, "owner");

  if (isGoogleFile(it)) {
    return new Response(null, {
      status: 409,
    });
  }

  return new Response(null, {
    headers: {
      "Upload-Offset": String(it.uploaded),
    },
  });
});

// ------------------------------------
// UPLOAD CHUNK TO VPS
// ------------------------------------

export const PUT = guard(async (req, s, { params }) => {
  const it = await load(Item, params.id, s, "owner");

  if (isGoogleFile(it)) {
    throw new Error("Google files cannot be uploaded through VPS storage.");
  }

  if (it.type !== "file") {
    throw new Error("Not a file.");
  }

  const off = Number(req.headers.get("upload-offset"));

  if (!Number.isSafeInteger(off) || off < 0) {
    throw new Error("Invalid upload offset.");
  }

  if (off !== it.uploaded) {
    return J(
      {
        error: "Offset mismatch",
        offset: it.uploaded,
      },
      409,
    );
  }

  const buf = Buffer.from(await req.arrayBuffer());

  if (off + buf.length > it.size) {
    throw new Error("More data than declared.");
  }

  const actualSize = await uploadChunk(params.id, buf, off);
  const expectedSize = off + buf.length;

  if (actualSize !== expectedSize) {
    throw new Error(
      `VPS storage size mismatch. Expected ${expectedSize}, received ${actualSize}.`,
    );
  }

  it.uploaded = actualSize;

  await it.save();

  if (actualSize === it.size && expectedSize > 0) {
    await logActivity(it, s, "upload", `Uploaded ${it.name}`);
  }

  return J({
    offset: actualSize,
  });
});

// ------------------------------------
// AUTHENTICATED DOWNLOAD / PREVIEW
// ------------------------------------

export const GET = guard(async (req, s, { params }) => {
  const it = await load(Item, params.id, s);

  // Google Docs and Sheets open in Google.
  if (isGoogleFile(it)) {
    const url = getGoogleFileUrl(it);

    if (!url) {
      throw new Error("Google file link is missing.");
    }

    await logActivity(it, s, "view", `Opened ${it.name}`);

    return Response.redirect(url, 302);
  }

  if (it.type !== "file" || it.uploaded < it.size) {
    throw new Error("File not available.");
  }

  const size = it.size;

  let start = 0;
  let end = size - 1;
  let status = 200;

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

  const inline =
    (/^(video|audio|image)\//.test(it.mime || "") &&
      !/svg/i.test(it.mime || "")) ||
    it.mime === "application/pdf";

  const downloadRequested = new URL(req.url).searchParams.get("dl") === "1";

  const attach = downloadRequested || !inline;

  const stream = size
    ? await createStoredFileReadStream(params.id, start, end)
    : null;

  const body = stream ? (Readable.toWeb(stream) as ReadableStream) : null;

  if (status === 200 || start === 0) {
    await logActivity(
      it,
      s,
      attach ? "download" : "view",
      attach ? `Downloaded ${it.name}` : `Viewed ${it.name}`,
    );
  }

  return new Response(body, {
    status,
    headers: {
      "Content-Type": it.mime || "application/octet-stream",
      "Content-Length": String(size ? end - start + 1 : 0),
      "Accept-Ranges": "bytes",
      ...(status === 206
        ? {
            "Content-Range": `bytes ${start}-${end}/${size}`,
          }
        : {}),
      "Content-Disposition": `${
        attach ? "attachment" : "inline"
      }; filename*=UTF-8''${encodeURIComponent(it.name || "download")}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
});

// ------------------------------------
// RENAME / MOVE / SHARE / RESTORE
// ------------------------------------

export const PATCH = guard(async (req, s, { params }) => {
  const b = await req.json();

  const sharing = "shared" in b || "org" in b;

  const it = await load(Item, params.id, s, sharing ? "owner" : "edit");

  const googleFile = isGoogleFile(it);

  // Individual Google sharing remains managed directly in Google.
  // Organisation visibility is synchronised with Drive.
  if (googleFile && "shared" in b) {
    throw new Error(
      "Individual sharing for Google Docs and Sheets must be managed directly in Google.",
    );
  }

  if ("org" in b && !["none", "view", "edit"].includes(b.org)) {
    throw new Error("Invalid organisation access level.");
  }

  const oldName = it.name;
  const oldShared = JSON.stringify(it.shared || []);
  const oldOrg = it.org || "none";
  const oldTrashed = it.trashed;

  // Rename actual Google file first.
  if (googleFile && typeof b.name === "string" && b.name.trim()) {
    const drive = await getGoogleDrive(String(it.owner));

    await drive.files.update({
      fileId: it.googleFileId,
      requestBody: {
        name: b.name.trim(),
      },
      fields: "id,name",
    });
  }

  if (typeof b.name === "string" && b.name.trim()) {
    it.name = b.name.trim();
  }

  // Move inside the custom Workspace Drive.
  if ("parent" in b) {
    if (b.parent) {
      const p = await load(Item, b.parent, s, "edit");

      if (p.type !== "folder" || String(p._id) === params.id) {
        throw new Error("Invalid destination.");
      }
    }

    it.parent = b.parent || null;
  }

  // Synchronise trash/restore with Google.
  if (typeof b.trashed === "boolean") {
    if (googleFile && b.trashed !== oldTrashed) {
      const drive = await getGoogleDrive(String(it.owner));

      await drive.files.update({
        fileId: it.googleFileId,
        requestBody: {
          trashed: b.trashed,
        },
        fields: "id,trashed",
      });
    }

    it.trashed = b.trashed;
  }

  // Individual sharing for local/VPS files.
  if (Array.isArray(b.shared)) {
    const normalized = b.shared.map((x: any) => ({
      user: x.user,
      role: x.role === "edit" ? "edit" : "view",
    }));

    const userIds = normalized.map((x: any) => String(x.user));

    if (new Set(userIds).size !== userIds.length) {
      throw new Error("Duplicate users cannot be shared.");
    }

    const activeUsers = await User.find({
      _id: {
        $in: userIds,
      },
      active: true,
    }).select("_id");

    if (activeUsers.length !== userIds.length) {
      throw new Error("One or more selected users are invalid or inactive.");
    }

    it.shared = normalized;
  }

  // Organisation visibility.
  if ("org" in b) {
    if (googleFile) {
      await syncGoogleOrganisationAccess(it, String(it.owner), b.org);
    }

    // Save organisation visibility even when some employees
    // have not connected their Google accounts.
    it.org = b.org;
  }

  await it.save();

  if (oldName !== it.name) {
    await logActivity(it, s, "rename", `Renamed from ${oldName} to ${it.name}`);
  }

  if (
    oldShared !== JSON.stringify(it.shared || []) ||
    oldOrg !== (it.org || "none")
  ) {
    const action =
      (it.shared?.length || 0) > 0 || it.org !== "none" ? "share" : "unshare";

    await logActivity(it, s, action, "File access permissions updated");
  }

  if (oldTrashed !== it.trashed) {
    await logActivity(
      it,
      s,
      it.trashed ? "delete" : "restore",
      it.trashed ? "Moved to trash" : "Restored from trash",
    );
  }

  return J(it);
});

// ------------------------------------
// RECURSIVE DELETE
// ------------------------------------

async function rm(it: any, session: any) {
  if (it.type === "folder") {
    const children = await Item.find({
      parent: it._id,
    });

    for (const child of children) {
      await rm(child, session);
    }
  } else if (isGoogleFile(it)) {
    const drive = await getGoogleDrive(String(it.owner));

    await drive.files.delete({
      fileId: it.googleFileId,
    });
  } else {
    await deleteStoredFile(String(it._id));
  }

  await logActivity(it, session, "delete", `Permanently deleted ${it.name}`);

  await it.deleteOne();
}

export const DELETE = guard(async (_r, s, { params }) => {
  const it = await load(Item, params.id, s, "owner");

  await rm(it, s);

  return J({
    ok: true,
  });
});
