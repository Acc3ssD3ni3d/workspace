import { guard, J } from "@/lib/http";
import { Event, User } from "@/lib/models";
import { createGoogleCalendarEvent, updateGoogleCalendarEvent, deleteGoogleCalendarEvent } from "@/lib/google-meet";
import { notifyWorkspaceCalendar } from "@/lib/calendar-notifications";

const validDates = (startValue: unknown, endValue: unknown) => {
  const start = new Date(String(startValue || ""));
  const end = new Date(String(endValue || ""));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("Please provide valid event dates.");
  if (end <= start) throw new Error("Event end time must be after its start time.");
  return { start, end };
};

export const GET = guard(async (req) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const query: any = {};
  if (from || to) query.start = {
    ...(from ? { $gte: new Date(from) } : {}),
    ...(to ? { $lt: new Date(to) } : {}),
  };
  const events = await Event.find(query)
    .select("title desc start end createdBy googleMeetLink googleEventId googleHtmlLink googleSpaceName organizerUser meetingStatus")
    .sort({ start: 1 }).limit(300).lean();
  return J(events);
});

export const POST = guard(async (req, session) => {
  const body = await req.json();
  const title = String(body.title || "").trim();
  if (!title) throw new Error("Event title is required.");
  if (title.length > 160) throw new Error("Title must be 160 characters or fewer.");
  const { start, end } = validDates(body.start, body.end);

  let google = { googleEventId: "", googleCalendarId: "", googleHtmlLink: "", googleMeetLink: "" };
  if (body.meet) {
    const attendees = await User.find({ active: true }).select("email").lean();
    google = await createGoogleCalendarEvent({
      userId: session.sub, title, description: String(body.desc || ""),
      start, end, attendeeEmails: attendees.map((u: any) => u.email),
    });
    if (!google.googleMeetLink) throw new Error("Google Calendar created the event but did not return a Google Meet link. Check Google Meet API and Calendar permissions.");
  }

  const event = await Event.create({
    title, desc: String(body.desc || "").slice(0, 5000), start, end,
    createdBy: session.name, organizerUser: session.sub,
    ...google, meetingStatus: start > new Date() ? "scheduled" : "live",
  });

  // Calendar creation must succeed even if one employee's email address rejects delivery.
  const notification = await notifyWorkspaceCalendar({
    title, description: String(body.desc || ""), start, end,
    meetLink: google.googleMeetLink, action: "created", excludeUserId: session.sub,
  });
  return J({ event, notification }, 201);
});

export const PATCH = guard(async (req, session) => {
  const body = await req.json();
  if (!body.id) throw new Error("Event ID is required.");
  const event = await Event.findById(body.id);
  if (!event) throw new Error("Event not found.");
  const title = String(body.title || event.title || "").trim();
  if (!title) throw new Error("Event title is required.");
  const { start, end } = validDates(body.start ?? event.start, body.end ?? event.end);

  if (event.googleEventId && event.organizerUser) {
    await updateGoogleCalendarEvent({
      userId: String(event.organizerUser), eventId: event.googleEventId,
      title, description: String(body.desc ?? event.desc ?? ""), start, end,
    });
  }

  event.title = title;
  event.desc = String(body.desc ?? event.desc ?? "").slice(0, 5000);
  event.start = start;
  event.end = end;
  event.meetingStatus = end <= new Date() ? "ended" : start > new Date() ? "scheduled" : "live";
  await event.save();

  const notification = await notifyWorkspaceCalendar({
    title, description: event.desc, start, end,
    meetLink: event.googleMeetLink, action: "updated", excludeUserId: session.sub,
  });
  return J({ event, notification });
});

export const DELETE = guard(async (req, session) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new Error("Event ID is required.");
  const event = await Event.findById(id);
  if (!event) throw new Error("Event not found.");
  if (event.googleEventId && event.organizerUser) {
    await deleteGoogleCalendarEvent(String(event.organizerUser), event.googleEventId);
  }
  await Event.deleteOne({ _id: id });
  const notification = await notifyWorkspaceCalendar({
    title: event.title || "Calendar event", description: event.desc || "",
    start: event.start || new Date(), end: event.end || new Date(),
    meetLink: event.googleMeetLink || "", action: "cancelled", excludeUserId: session.sub,
  });
  return J({ ok: true, notification });
});
