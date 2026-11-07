import { guard, J } from "@/lib/http";
import { getStorageDirectoryStats } from "@/lib/sftp";

export const GET = guard(async () => {
  try {
    const files = await getStorageDirectoryStats();

    return J({
      connected: true,
      message: "VPS storage connection successful.",
      directory: "/var/lib/workspace-storage",
      fileCount: files.length,
    });
  } catch (error) {
    return J(
      {
        connected: false,
        message:
          error instanceof Error
            ? error.message
            : "VPS storage connection failed.",
      },
      503,
    );
  }
}, true);
