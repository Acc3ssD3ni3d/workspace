import { guard, J } from "@/lib/http";
import { Item } from "@/lib/models";
import { load, roleOf } from "@/lib/perm";
import { QUOTA } from "@/lib/config";

const usedBytes = async () =>
  (
    await Item.aggregate([
      {
        $group: {
          _id: null,
          t: { $sum: "$size" },
        },
      },
    ])
  )[0]?.t || 0;

// ------------------------------------
// GET DRIVE ITEMS
// view = mine | shared | trash
// parent = folder id
// ------------------------------------

export const GET = guard(async (req, s) => {
  const u = new URL(req.url);

  const view = u.searchParams.get("view") || "mine";
  const parent = u.searchParams.get("parent") || null;

  let q: any;

  if (view === "trash") {
    q = {
      owner: s.sub,
      trashed: true,
    };
  } else if (view === "shared" && !parent) {
    q = {
      owner: { $ne: s.sub },
      trashed: false,
      $or: [{ "shared.user": s.sub }, { org: { $in: ["view", "edit"] } }],
    };
  } else {
    if (parent) {
      await load(Item, parent, s);
    }

    q =
      view === "shared"
        ? {
            parent,
            trashed: false,
          }
        : {
            owner: s.sub,
            parent,
            trashed: false,
          };
  }

  const items = await Item.find(q).sort({ type: -1, name: 1 }).lean();

  // Resolve permissions concurrently rather than waiting for one folder lookup
  // at a time for every row in the directory.
  const [out, used] = await Promise.all([
    Promise.all(items.map(async (item) => ({
      ...item,
      role: await roleOf(item, s),
      googleFileId: item.googleFileId || "",
      googleWebViewLink: item.googleWebViewLink || "",
      googleResourceType: item.googleResourceType || "",
      storageProvider: item.storageProvider || "local",
    }))),
    usedBytes(),
  ]);

  return J({ items: out, used, quota: QUOTA });
});

// ------------------------------------
// POST
// Create a folder or start a VPS upload
// ------------------------------------

export const POST = guard(async (req, s) => {
  const b = await req.json();

  const parent = b.parent || null;
  const name = String(b.name || "").trim();

  if (!name) {
    throw new Error("Name is required");
  }

  if (name.length > 255) {
    throw new Error("Name cannot exceed 255 characters");
  }

  if (parent) {
    const p = await load(Item, parent, s, "edit");

    if (p.type !== "folder") {
      throw new Error("Not a folder");
    }
  }

  // Create folder
  if (b.type === "folder") {
    const folder = await Item.create({
      name,
      type: "folder",
      parent,
      owner: s.sub,
      storageProvider: "local",
      trashed: false,
    });

    return J(folder, 201);
  }

  // Start normal VPS file upload
  if (b.type !== "file") {
    throw new Error("Invalid item type");
  }

  const size = Number(b.size);

  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error("Invalid file size");
  }

  if ((await usedBytes()) + size > QUOTA) {
    throw new Error("Storage quota reached. Ask an admin.");
  }

  const file = await Item.create({
    name,
    type: "file",
    parent,
    owner: s.sub,
    size,
    uploaded: 0,
    mime: b.mime || "application/octet-stream",

    // Normal uploaded files remain on VPS.
    storageProvider: "local",

    trashed: false,
  });

  return J(file, 201);
});
