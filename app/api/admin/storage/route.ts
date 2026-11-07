import { guard, J } from "@/lib/http";
import { Item } from "@/lib/models";
import { QUOTA } from "@/lib/config";
import { getStorageDirectoryStats } from "@/lib/sftp";

export const GET = guard(async () => {
  // Read actual files from the VPS storage directory.
  const vpsFiles = await getStorageDirectoryStats();

  const storedFiles = vpsFiles.filter(
    (file) => file.type === "-" && /^[a-f0-9]{24}$/.test(file.name),
  );

  const usedBytes = storedFiles.reduce((total, file) => total + file.size, 0);

  // Read file metadata from MongoDB.
  const [stats] = await Item.aggregate([
    { $match: { type: "file" } },
    {
      $group: {
        _id: null,
        reservedBytes: { $sum: "$size" },
        totalFiles: { $sum: 1 },
      },
    },
  ]);

  const categories = await Item.aggregate([
    { $match: { type: "file" } },
    {
      $group: {
        _id: "$mime",
        count: { $sum: 1 },
        size: { $sum: "$uploaded" },
      },
    },
    { $sort: { size: -1 } },
  ]);

  const items = await Item.find({})
    .populate("owner", "name email role")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  return J({
    storage: {
      usedBytes,
      reservedBytes: stats?.reservedBytes || 0,
      quotaBytes: QUOTA,
      remainingBytes: Math.max(0, QUOTA - usedBytes),
      totalFiles: stats?.totalFiles || 0,
      storedFiles: storedFiles.length,
      storageLocation: "Hostinger VPS",
      directory: "/var/lib/workspace-storage",
    },
    categories,
    items: items.map((item: any) => ({
      id: String(item._id),
      name: item.name,
      type: item.type,
      mime: item.mime || "",
      size: item.size || 0,
      uploaded: item.uploaded || 0,
      trashed: item.trashed || false,
      createdBy: item.owner
        ? {
            id: String(item.owner._id),
            name: item.owner.name,
            email: item.owner.email,
            role: item.owner.role,
          }
        : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  });
}, true);
