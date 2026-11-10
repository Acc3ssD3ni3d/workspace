import "server-only";
import { ChatGroup, User } from "@/lib/models";
import type { Session } from "@/lib/auth";

/* ==========================================================================
   1. WHO CAN EDIT THE ORGANISATION CALENDAR
   Admins always can. Members only when an admin switched on
   "Organisation calendar editor" for them (User.orgCalendarEditor).
   ========================================================================== */
export async function canEditOrgCalendar(s: Session): Promise<boolean> {
  if (s.role === "admin") return true;
  return Boolean(
    await User.exists({ _id: s.sub, active: true, orgCalendarEditor: true }),
  );
}

/* ==========================================================================
   2. VISIBILITY FILTERS (MongoDB)
   scope = "personal" -> My Calendar tab
   scope = "org"      -> Organisation tab
   scope = "all"      -> everything this user may see (Overview, Meet)
   ========================================================================== */
export type CalendarScope = "personal" | "org" | "all";

export function calendarFilter(userId: string, scope: CalendarScope) {
  // Organisation entries this user is allowed to see.
  const orgVisible = {
    $or: [
      { visibility: "everyone" },
      { visibility: { $exists: false } },
      { organizerUser: userId },
      { audience: userId },
    ],
  };

  // Organisation tab: org events + meetings that were sent to everyone.
  const org = {
    $and: [
      { scope: { $ne: "personal" } },
      { $or: [{ kind: { $ne: "meeting" } }, { visibility: "everyone" }] },
      orgVisible,
    ],
  };

  // My Calendar tab: my personal events + meetings I created or was invited to.
  const personal = {
    $or: [
      { scope: "personal", organizerUser: userId },
      {
        kind: "meeting",
        visibility: { $ne: "everyone" },
        $or: [{ organizerUser: userId }, { audience: userId }],
      },
    ],
  };

  if (scope === "personal") return personal;
  if (scope === "org") return org;
  return { $or: [personal, org] };
}

/* ==========================================================================
   3. PER-EVENT EDIT PERMISSION
   ========================================================================== */
export function canEditEvent(
  event: any,
  s: Session,
  orgEditor: boolean,
): boolean {
  const mine = String(event.organizerUser || "") === String(s.sub);

  if (event.scope === "personal") return mine;
  if (event.kind === "meeting") return mine || s.role === "admin";
  return orgEditor;
}

/* ==========================================================================
   4. AUDIENCE (selected people and/or a chat group)
   Returns active user ids, never including the creator.
   ========================================================================== */
export async function resolveAudience(
  body: { audience?: unknown; groupId?: unknown },
  s: Session,
): Promise<string[]> {
  const ids = new Set<string>(
    Array.isArray(body.audience)
      ? body.audience.map((id) => String(id)).filter((id) => /^[a-f0-9]{24}$/i.test(id))
      : [],
  );

  const groupId = String(body.groupId || "");

  if (groupId) {
    if (!/^[a-f0-9]{24}$/i.test(groupId)) throw new Error("Invalid group.");

    const group: any = await ChatGroup.findById(groupId).select("members").lean();

    if (!group) throw new Error("Group not found.");

    const isMember = (group.members || []).some(
      (member: any) => String(member) === String(s.sub),
    );

    if (!isMember && s.role !== "admin") {
      throw new Error("You are not a member of that group.");
    }

    (group.members || []).forEach((member: any) => ids.add(String(member)));
  }

  ids.delete(String(s.sub));

  if (!ids.size) return [];

  const active = await User.find({ _id: { $in: [...ids] }, active: true })
    .select("_id")
    .lean();

  return active.map((user: any) => String(user._id));
}

/* ==========================================================================
   5. EMAILS OF AUDIENCE (Google Calendar invitations)
   ========================================================================== */
export async function emailsFor(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const users = await User.find({ _id: { $in: ids }, active: true })
    .select("email")
    .lean();
  return users.map((user: any) => user.email).filter(Boolean);
}
