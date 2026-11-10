import { guard, J } from "@/lib/http";
import { ChatGroup, Message, User } from "@/lib/models";
import { notifyUsers } from "@/lib/notify";

/* ==========================================================================
   Group chats.
   GET     my groups (with member names)
   POST    { name, members: [userId] }                 create
   PATCH   { id, name?, add?: [id], remove?: [id] }    creator / admin manage,
           any member may remove themselves (leave)
   DELETE  ?id=<groupId>                               creator / admin
   ========================================================================== */
const isId = (value: unknown) => /^[a-f0-9]{24}$/i.test(String(value));

async function activeIds(ids: unknown[]) {
  const wanted = [...new Set(ids.map(String).filter(isId))];
  if (!wanted.length) return [];
  const rows = await User.find({ _id: { $in: wanted }, active: true }).select("_id").lean();
  return rows.map((row: any) => String(row._id));
}

export const GET = guard(async (_req, s) => {
  const groups: any[] = await ChatGroup.find({ members: s.sub }).sort({ updatedAt: -1 }).lean();
  const memberIds = [...new Set(groups.flatMap((group) => group.members.map(String)))];
  const users: any[] = memberIds.length
    ? await User.find({ _id: { $in: memberIds } }).select("name").lean()
    : [];
  const nameOf = new Map(users.map((user) => [String(user._id), user.name]));

  return J(groups.map((group) => ({
    _id: group._id,
    name: group.name,
    createdBy: String(group.createdBy),
    canManage: s.role === "admin" || String(group.createdBy) === String(s.sub),
    members: group.members.map((id: any) => ({ _id: String(id), name: nameOf.get(String(id)) || "Member" })),
  })));
});

export const POST = guard(async (req, s) => {
  const body = await req.json();
  const name = String(body.name || "").trim();
  if (!name) throw new Error("Group name is required.");
  if (name.length > 80) throw new Error("Group name must be 80 characters or fewer.");

  const members = new Set(await activeIds(Array.isArray(body.members) ? body.members : []));
  members.delete(String(s.sub));
  if (!members.size) throw new Error("Add at least one other member.");
  members.add(String(s.sub));

  const group: any = await ChatGroup.create({ name, members: [...members], createdBy: s.sub });

  await notifyUsers([...members].filter((id) => id !== String(s.sub)), {
    type: "chat",
    title: `Added to group: ${name}`,
    body: `${s.name} created this group`,
    link: `/chat?channel=${encodeURIComponent(`group:${group._id}`)}`,
  });

  return J({ _id: group._id, name: group.name }, 201);
});

export const PATCH = guard(async (req, s) => {
  const body = await req.json();
  if (!isId(body.id)) throw new Error("Group ID is required.");

  const group: any = await ChatGroup.findOne({ _id: body.id, members: s.sub });
  if (!group) throw new Error("Group not found.");

  const manager = s.role === "admin" || String(group.createdBy) === String(s.sub);
  const remove = Array.isArray(body.remove) ? body.remove.map(String) : [];
  const leavingOnly = remove.length === 1 && remove[0] === String(s.sub) && !body.name && !body.add;

  if (!manager && !leavingOnly) throw new Error("Only the group creator or an administrator can change this group.");

  if (typeof body.name === "string" && body.name.trim()) {
    group.name = body.name.trim().slice(0, 80);
  }

  const added = await activeIds(Array.isArray(body.add) ? body.add : []);
  const current = new Set<string>(group.members.map(String));
  const newlyAdded = added.filter((id) => !current.has(id));
  newlyAdded.forEach((id) => current.add(id));
  remove.forEach((id: string) => current.delete(id));

  if (current.size < 1) throw new Error("A group needs at least one member.");

  group.members = [...current];
  await group.save();

  if (newlyAdded.length) {
    await notifyUsers(newlyAdded, {
      type: "chat",
      title: `Added to group: ${group.name}`,
      body: `${s.name} added you`,
      link: `/chat?channel=${encodeURIComponent(`group:${group._id}`)}`,
    });
  }

  return J({ ok: true });
});

export const DELETE = guard(async (req, s) => {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!isId(id)) throw new Error("Group ID is required.");

  const group: any = await ChatGroup.findById(id);
  if (!group) throw new Error("Group not found.");
  if (s.role !== "admin" && String(group.createdBy) !== String(s.sub)) {
    throw new Error("Only the group creator or an administrator can delete this group.");
  }

  await ChatGroup.deleteOne({ _id: id });
  await Message.deleteMany({ channel: `group:${id}` });
  return J({ ok: true });
});
