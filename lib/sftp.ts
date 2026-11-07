import "server-only";

import SftpClient from "ssh2-sftp-client";
import type { Readable } from "stream";
import { randomUUID } from "crypto";

const HOST = process.env.STORAGE_HOST || "";
const PORT = Number(process.env.STORAGE_PORT || 22);
const USER = process.env.STORAGE_USER || "workspace-storage";

const REMOTE_DIR =
  process.env.STORAGE_REMOTE_DIR || "/var/lib/workspace-storage";

function getPrivateKey() {
  const key = process.env.STORAGE_SSH_PRIVATE_KEY;

  if (!key) {
    throw new Error("STORAGE_SSH_PRIVATE_KEY is not configured.");
  }

  return key.replace(/\\n/g, "\n").trim() + "\n";
}

function validateId(id: string) {
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    throw new Error("Invalid storage file ID.");
  }
}

export function remotePath(id: string) {
  validateId(id);
  return `${REMOTE_DIR}/${id}`;
}

async function connectSftp() {
  if (!HOST) {
    throw new Error("STORAGE_HOST is not configured.");
  }

  const client = new SftpClient();

  try {
    await client.connect({
      host: HOST,
      port: PORT,
      username: USER,
      privateKey: getPrivateKey(),
      readyTimeout: 20000,
    });

    return client;
  } catch (error) {
    try {
      await client.end();
    } catch {}

    throw new Error(
      `Unable to connect to VPS storage: ${
        error instanceof Error ? error.message : "Connection failed"
      }`,
    );
  }
}

// ------------------------------------
// EXISTING CHUNKED UPLOAD
// ------------------------------------

export async function uploadChunk(id: string, buffer: Buffer, offset: number) {
  const client = await connectSftp();

  try {
    const destination = remotePath(id);
    const exists = await client.exists(destination);

    if (offset === 0) {
      if (exists) {
        throw new Error("Storage file already exists.");
      }

      if (buffer.length > 0) {
        await client.put(buffer, destination);
      }
    } else {
      if (!exists) {
        throw new Error("Storage file does not exist.");
      }

      const stat = await client.stat(destination);

      if (stat.size !== offset) {
        throw new Error(`Storage offset mismatch. Actual offset: ${stat.size}`);
      }

      if (buffer.length > 0) {
        await client.append(buffer, destination);
      }
    }

    const result = await client.stat(destination);

    return result.size;
  } finally {
    await client.end();
  }
}

// ------------------------------------
// NEW: SAVE OR REPLACE STORED FILE
// ------------------------------------

export async function uploadStoredFile(
  id: string,
  buffer: Buffer,
): Promise<number> {
  const client = await connectSftp();

  const destination = remotePath(id);
  const temporaryPath = `${destination}.${randomUUID()}.tmp`;
  const backupPath = `${destination}.${randomUUID()}.bak`;

  let destinationMoved = false;

  try {
    // Upload the new file separately first.
    await client.put(buffer, temporaryPath);

    const destinationExists = await client.exists(destination);

    // Preserve the old file until the new upload is ready.
    if (destinationExists) {
      await client.rename(destination, backupPath);
      destinationMoved = true;
    }

    try {
      // Replace the old file with the new version.
      await client.rename(temporaryPath, destination);

      // Remove the old version only after successful replacement.
      if (destinationMoved) {
        await client.delete(backupPath);
        destinationMoved = false;
      }
    } catch (error) {
      // Restore the old version if replacement fails.
      if (
        destinationMoved &&
        !(await client.exists(destination)) &&
        (await client.exists(backupPath))
      ) {
        await client.rename(backupPath, destination);
        destinationMoved = false;
      }

      throw error;
    }

    const stat = await client.stat(destination);

    return stat.size;
  } finally {
    try {
      if (await client.exists(temporaryPath)) {
        await client.delete(temporaryPath);
      }
    } catch {}

    try {
      if (destinationMoved && (await client.exists(backupPath))) {
        await client.delete(backupPath);
      }
    } catch {}

    await client.end();
  }
}

// ------------------------------------
// READ STORED FILE
// ------------------------------------

export async function getStoredFile(id: string): Promise<Buffer> {
  const client = await connectSftp();

  try {
    const filePath = remotePath(id);
    const exists = await client.exists(filePath);

    if (!exists) {
      throw new Error("Stored file not found.");
    }

    const result = await client.get(filePath);

    if (!Buffer.isBuffer(result)) {
      throw new Error("Unable to read stored file.");
    }

    return result;
  } finally {
    await client.end();
  }
}

// ------------------------------------
// STREAM STORED FILE
// ------------------------------------

export async function createStoredFileReadStream(
  id: string,
  start?: number,
  end?: number,
): Promise<Readable> {
  const client = await connectSftp();

  try {
    const filePath = remotePath(id);
    const exists = await client.exists(filePath);

    if (!exists) {
      throw new Error("Stored file not found.");
    }

    const options: {
      start?: number;
      end?: number;
    } = {};

    if (start !== undefined) options.start = start;
    if (end !== undefined) options.end = end;

    const stream = client.createReadStream(filePath, options) as Readable;

    let closed = false;

    const closeConnection = async () => {
      if (closed) return;

      closed = true;

      try {
        await client.end();
      } catch {}
    };

    stream.once("end", closeConnection);
    stream.once("close", closeConnection);
    stream.once("error", closeConnection);

    return stream;
  } catch (error) {
    try {
      await client.end();
    } catch {}

    throw error;
  }
}

// ------------------------------------
// DELETE STORED FILE
// ------------------------------------

export async function deleteStoredFile(id: string) {
  const client = await connectSftp();

  try {
    const filePath = remotePath(id);
    const exists = await client.exists(filePath);

    if (exists) {
      await client.delete(filePath);
    }
  } finally {
    await client.end();
  }
}

// ------------------------------------
// GET STORED FILE SIZE
// ------------------------------------

export async function getStoredFileSize(id: string) {
  const client = await connectSftp();

  try {
    const filePath = remotePath(id);
    const exists = await client.exists(filePath);

    if (!exists) return 0;

    const stat = await client.stat(filePath);

    return stat.size;
  } finally {
    await client.end();
  }
}

// ------------------------------------
// STORAGE DIRECTORY STATISTICS
// ------------------------------------

export async function getStorageDirectoryStats() {
  const client = await connectSftp();

  try {
    return await client.list(REMOTE_DIR);
  } finally {
    await client.end();
  }
}
