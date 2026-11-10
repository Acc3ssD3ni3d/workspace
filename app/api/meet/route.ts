import { guard, J } from "@/lib/http";
import { Event, User } from "@/lib/models";
import { createGoogleMeetSpace } from "@/lib/google-meet";
import { notifyWorkspaceCalendar } from "@/lib/calendar-notifications";
import { calendarFilter, resolveAudience } from "@/lib/calendar-access";

/* ==========================================================================
   GET  Meetings this user may see.
   A meeting sent to selected people / a group is listed ONLY for the
   creator and the invited people.
   ========================================================================== */
export const GET = guard(async (_req, session) => {
  const now = new Date();

  const meetings: any[] = await Event.find({
    $and: [{ googleMeetLink: { $ne: "" } }, calendarFilter(session.sub, "all")],
  })
    .select("title desc start end createdBy googleMeetLink googleEventId googleHtmlLink meetingStatus visibility audience organizerUser")
    .sort({ start: -1 }).limit(100).lean();

  // Names of invited people, shown on the meeting card.
  const ids = [...new Set(meetings.flatMap((m) => (m.audience || []).map(String)))];
  const people: any[] = ids.length
    ? await User.find({ _id: { $in: ids } }).select("name").lean()
    : [];
  const nameOf = new Map(people.map((user) => [String(user._id), user.name]));

  return J(meetings.map((m) => ({
    ...m,
    visibility: m.visibility || "everyone",
    invited: (m.audience || []).map((id: any) => nameOf.get(String(id)) || "Member"),
    mine: String(m.organizerUser || "") === String(session.sub),
    meetingStatus: new Date(m.end) <= now ? "ended" : new Date(m.start) > now ? "scheduled" : "live",
  })));
});

/* ==========================================================================
   POST  Start an instant meeting.
   visibility "everyone"  -> all members are notified (previous behaviour)
   visibility "selected"  -> only the chosen people / group are notified and
                             only they can see the meeting
   ========================================================================== */
export const POST = guard(async (req, session) => {
  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim() || `Quick meeting - ${session.name}`;
  if (title.length > 160) throw new Error("Meeting title must be 160 characters or fewer.");
  const start = body.start ? new Date(body.start) : new Date();
  const end = body.end ? new Date(body.end) : new Date(start.getTime() + 60 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new Error("Please provide a valid meeting start and end time.");

  const visibility: "everyone" | "selected" = body.visibility === "selected" ? "selected" : "everyone";
  const audience = visibility === "selected" ? await resolveAudience(body, session) : [];
  if (visibility === "selected" && !audience.length) throw new Error("Choose at least one person or group for this meeting.");

  const meet = await createGoogleMeetSpace(session.sub);
  const event = await Event.create({
    title, desc: String(body.desc || "").slice(0, 5000), start, end,
    createdBy: session.name, organizerUser: session.sub,
    googleMeetLink: meet.meetingUri, googleSpaceName: meet.spaceName,
    scope: "org", kind: "meeting", visibility, audience,
    meetingStatus: end <= new Date() ? "ended" : start > new Date() ? "scheduled" : "live",
  });

  const notification = await notifyWorkspaceCalendar({
    title, description: String(body.desc || ""), start, end,
    meetLink: meet.meetingUri, action: "created", excludeUserId: session.sub,
    recipientIds: visibility === "selected" ? audience : undefined,
    kind: "meeting",
  });
  return J({
    _id: event._id, title: event.title, start: event.start, end: event.end,
    createdBy: event.createdBy, googleMeetLink: event.googleMeetLink,
    visibility, meetingStatus: event.meetingStatus, notification,
  }, 201);
});
