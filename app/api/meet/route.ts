import { guard, J } from "@/lib/http";
import { Event } from "@/lib/models";
import { createGoogleMeetSpace } from "@/lib/google-meet";
import { notifyWorkspaceCalendar } from "@/lib/calendar-notifications";

export const GET = guard(async () => {
  const now = new Date();
  const meetings = await Event.find({ googleMeetLink: { $ne: "" } })
    .select("title desc start end createdBy googleMeetLink googleEventId googleHtmlLink meetingStatus")
    .sort({ start: -1 }).limit(100).lean();
  return J(meetings.map((m: any) => ({
    ...m,
    meetingStatus: new Date(m.end) <= now ? "ended" : new Date(m.start) > now ? "scheduled" : "live",
  })));
});

export const POST = guard(async (req, session) => {
  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim() || `Quick meeting - ${session.name}`;
  if (title.length > 160) throw new Error("Meeting title must be 160 characters or fewer.");
  const start = body.start ? new Date(body.start) : new Date();
  const end = body.end ? new Date(body.end) : new Date(start.getTime() + 60 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new Error("Please provide a valid meeting start and end time.");

  const meet = await createGoogleMeetSpace(session.sub);
  const event = await Event.create({
    title, desc: String(body.desc || "").slice(0, 5000), start, end,
    createdBy: session.name, organizerUser: session.sub,
    googleMeetLink: meet.meetingUri, googleSpaceName: meet.spaceName,
    meetingStatus: end <= new Date() ? "ended" : start > new Date() ? "scheduled" : "live",
  });
  const notification = await notifyWorkspaceCalendar({
    title, description: String(body.desc || ""), start, end,
    meetLink: meet.meetingUri, action: "created", excludeUserId: session.sub,
  });
  return J({
    _id: event._id, title: event.title, start: event.start, end: event.end,
    createdBy: event.createdBy, googleMeetLink: event.googleMeetLink,
    meetingStatus: event.meetingStatus, notification,
  }, 201);
});
