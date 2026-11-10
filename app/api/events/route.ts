import { guard, J } from "@/lib/http";
import { Event, User } from "@/lib/models";
import { createGoogleCalendarEvent, updateGoogleCalendarEvent, deleteGoogleCalendarEvent } from "@/lib/google-meet";
import { notifyWorkspaceCalendar } from "@/lib/calendar-notifications";
import {
  calendarFilter,
  canEditEvent,
  canEditOrgCalendar,
  emailsFor,
  resolveAudience,
  type CalendarScope,
} from "@/lib/calendar-access";

/* ==========================================================================
   1. HELPERS
   ========================================================================== */
const validDates = (startValue: unknown, endValue: unknown) => {
  const start = new Date(String(startValue || ""));
  const end = new Date(String(endValue || ""));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("Please provide valid event dates.");
  if (end <= start) throw new Error("Event end time must be after its start time.");
  return { start, end };
};

const FIELDS =
  "title desc start end createdBy googleMeetLink googleEventId googleHtmlLink googleSpaceName organizerUser meetingStatus scope kind visibility audience";

/* ==========================================================================
   2. GET  /api/events?scope=personal|org|all&from=&to=
   Default is "all" so the Overview shows personal + organisation events.
   Personal events and private organisation events are never returned to
   anybody else (not even admins).
   ========================================================================== */
export const GET = guard(async (req, session) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const requested = url.searchParams.get("scope");
  const scope: CalendarScope =
    requested === "personal" || requested === "org" ? requested : "all";

  const conditions: any[] = [calendarFilter(session.sub, scope)];

  if (from || to) {
    conditions.push({
      start: {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lt: new Date(to) } : {}),
      },
    });
  }

  const [events, orgEditor] = await Promise.all([
    Event.find({ $and: conditions }).select(FIELDS).sort({ start: 1 }).limit(300).lean(),
    canEditOrgCalendar(session),
  ]);

  return J(
    events.map((event: any) => ({
      ...event,
      scope: event.scope || "org",
      kind: event.kind || "event",
      visibility: event.visibility || "everyone",
      mine: String(event.organizerUser || "") === String(session.sub),
      canEdit: canEditEvent(event, session, orgEditor),
    })),
  );
});

/* ==========================================================================
   3. POST  create an event
   scope "personal"  any member, only the creator sees it
   scope "org"       admins and Organisation calendar editors only
   kind "meeting"    any member (created from the Meet page)
   ========================================================================== */
export const POST = guard(async (req, session) => {
  const body = await req.json();
  const title = String(body.title || "").trim();
  if (!title) throw new Error("Event title is required.");
  if (title.length > 160) throw new Error("Title must be 160 characters or fewer.");
  const { start, end } = validDates(body.start, body.end);

  const kind: "event" | "meeting" = body.kind === "meeting" ? "meeting" : "event";
  const scope: "personal" | "org" =
    kind === "meeting" ? "org" : body.scope === "personal" ? "personal" : "org";

  let visibility: "everyone" | "selected" | "private" = "everyone";
  let audience: string[] = [];

  if (scope === "personal") {
    visibility = "private";
  } else {
    if (kind === "event" && !(await canEditOrgCalendar(session))) {
      throw new Error("Only administrators and Organisation calendar editors can add Organisation events.");
    }

    const wanted = String(body.visibility || "everyone");
    visibility = wanted === "private" || wanted === "selected" ? wanted : "everyone";

    // Meetings cannot be fully private: they are for the people invited.
    if (kind === "meeting" && visibility === "private") visibility = "selected";

    if (visibility === "selected") {
      audience = await resolveAudience(body, session);
      if (!audience.length) throw new Error("Choose at least one person or group.");
    }
  }

  // Who receives the Google Calendar invitation.
  let attendeeEmails: string[] = [];
  if (visibility === "everyone") {
    const everyone = await User.find({ active: true }).select("email").lean();
    attendeeEmails = everyone.map((user: any) => user.email);
  } else if (visibility === "selected") {
    attendeeEmails = await emailsFor(audience);
  }

  let google = { googleEventId: "", googleCalendarId: "", googleHtmlLink: "", googleMeetLink: "" };
  if (body.meet) {
    google = await createGoogleCalendarEvent({
      userId: session.sub, title, description: String(body.desc || ""),
      start, end, attendeeEmails,
    });
    if (!google.googleMeetLink) throw new Error("Google Calendar created the event but did not return a Google Meet link. Check Google Meet API and Calendar permissions.");
  }

  const event = await Event.create({
    title, desc: String(body.desc || "").slice(0, 5000), start, end,
    createdBy: session.name, organizerUser: session.sub,
    scope, kind, visibility, audience,
    ...google, meetingStatus: start > new Date() ? "scheduled" : "live",
  });

  // Personal and private entries are never announced to anybody.
  let notification = { sent: 0, failed: 0 };
  if (visibility === "everyone" || visibility === "selected") {
    notification = await notifyWorkspaceCalendar({
      title, description: String(body.desc || ""), start, end,
      meetLink: google.googleMeetLink, action: "created", excludeUserId: session.sub,
      recipientIds: visibility === "selected" ? audience : undefined,
      kind,
    });
  }
  return J({ event, notification }, 201);
});

/* ==========================================================================
   4. PATCH  edit an event
   ========================================================================== */
export const PATCH = guard(async (req, session) => {
  const body = await req.json();
  if (!body.id) throw new Error("Event ID is required.");

  const event = await Event.findOne({
    $and: [{ _id: body.id }, calendarFilter(session.sub, "all")],
  });
  if (!event) throw new Error("Event not found.");

  const orgEditor = await canEditOrgCalendar(session);
  if (!canEditEvent(event, session, orgEditor)) {
    throw new Error("You do not have permission to edit this event.");
  }

  const title = String(body.title || event.title || "").trim();
  if (!title) throw new Error("Event title is required.");
  const { start, end } = validDates(body.start ?? event.start, body.end ?? event.end);

  // Visibility can be changed on Organisation entries.
  if (event.scope !== "personal" && event.kind !== "meeting" && body.visibility) {
    const wanted = String(body.visibility);
    event.visibility = wanted === "private" || wanted === "selected" ? wanted : "everyone";
    if (event.visibility === "selected") {
      const audience = await resolveAudience(body, session);
      if (!audience.length) throw new Error("Choose at least one person or group.");
      event.audience = audience as any;
    } else {
      event.audience = [] as any;
    }
  }

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

  let notification = { sent: 0, failed: 0 };
  if (event.visibility === "everyone" || event.visibility === "selected") {
    notification = await notifyWorkspaceCalendar({
      title, description: event.desc, start, end,
      meetLink: event.googleMeetLink, action: "updated", excludeUserId: session.sub,
      recipientIds: event.visibility === "selected" ? (event.audience || []).map(String) : undefined,
      kind: event.kind,
    });
  }
  return J({ event, notification });
});

/* ==========================================================================
   5. DELETE  remove an event
   ========================================================================== */
export const DELETE = guard(async (req, session) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new Error("Event ID is required.");

  const event = await Event.findOne({
    $and: [{ _id: id }, calendarFilter(session.sub, "all")],
  });
  if (!event) throw new Error("Event not found.");

  const orgEditor = await canEditOrgCalendar(session);
  if (!canEditEvent(event, session, orgEditor)) {
    throw new Error("You do not have permission to delete this event.");
  }

  if (event.googleEventId && event.organizerUser) {
    await deleteGoogleCalendarEvent(String(event.organizerUser), event.googleEventId);
  }
  await Event.deleteOne({ _id: id });

  let notification = { sent: 0, failed: 0 };
  if (event.visibility === "everyone" || event.visibility === "selected") {
    notification = await notifyWorkspaceCalendar({
      title: event.title || "Calendar event", description: event.desc || "",
      start: event.start || new Date(), end: event.end || new Date(),
      meetLink: event.googleMeetLink || "", action: "cancelled", excludeUserId: session.sub,
      recipientIds: event.visibility === "selected" ? (event.audience || []).map(String) : undefined,
      kind: event.kind,
    });
  }
  return J({ ok: true, notification });
});
