import { guard, J } from "@/lib/http";
import { Item, User, FileActivity } from "@/lib/models";
import { load } from "@/lib/perm";

type UserInfo = {
  _id: unknown;
  name?: string;
  email?: string;
  active?: boolean;
};

export const GET = guard(async (_req, s, { params }) => {
  // Only owner or administrator can inspect access and activity.
  const item = await load(Item, params.id, s, "owner");

  // Explicitly type Mongoose lean results.
  const owner = (await User.findById(item.owner)
    .select("name email")
    .lean()) as UserInfo | null;

  const sharedEntries = item.shared || [];

  const sharedUserIds = sharedEntries.map((entry: any) => entry.user);

  const sharedUsers: UserInfo[] = sharedUserIds.length
    ? ((await User.find({
        _id: { $in: sharedUserIds },
      })
        .select("name email active")
        .lean()) as UserInfo[])
    : [];

  const peopleWithAccess = sharedEntries.map((entry: any) => {
    const person = sharedUsers.find(
      (user) => String(user._id) === String(entry.user),
    );

    return {
      id: String(entry.user),
      name: person?.name || "Unknown user",
      email: person?.email || "",
      role: entry.role,
      active: person?.active ?? false,
      source: "direct",
    };
  });

  const activities = await FileActivity.find({
    item: item._id,
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .select("actor actorName actorEmail action accessMethod details createdAt")
    .lean();

  const link = item.linkAccess;

  return J({
    file: {
      id: String(item._id),
      name: item.name,
      type: item.type,
      mime: item.mime || "",
      size: item.size || 0,
      uploaded: item.uploaded || 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      lastAccessedAt: item.lastAccessedAt || null,
      accessCount: item.accessCount || 0,
    },

    owner: owner
      ? {
          id: String(item.owner),
          name: owner.name || "Unknown owner",
          email: owner.email || "",
        }
      : null,

    access: {
      isPrivate:
        peopleWithAccess.length === 0 &&
        (item.org || "none") === "none" &&
        !link?.enabled,

      people: peopleWithAccess,

      organisation: {
        enabled: item.org === "view" || item.org === "edit",
        role: item.org || "none",
        label:
          item.org === "view"
            ? "Everyone in organisation can view"
            : item.org === "edit"
              ? "Everyone in organisation can edit"
              : "Organisation access disabled",
      },

      link: {
        enabled: Boolean(link?.enabled),
        role: link?.role || "view",
        expiresAt: link?.expiresAt || null,
        createdAt: link?.createdAt || null,
      },
    },

    activity: activities.map((entry: any) => ({
      id: String(entry._id),
      actorName: entry.actorName || "Unknown user",
      actorEmail: entry.actorEmail || "",
      action: entry.action,
      accessMethod: entry.accessMethod,
      details: entry.details || "",
      createdAt: entry.createdAt,
    })),
  });
});
