import "server-only";
import { randomUUID } from "crypto";
import { google } from "googleapis";
import { getGoogleClient } from "@/lib/google-tokens";

export type MeetResult = {
  spaceName: string;
  meetingUri: string;
  meetingCode: string;
};

export async function createGoogleMeetSpace(userId: string): Promise<MeetResult> {
  const client = await getGoogleClient(userId);
  try {
    const response = await client.request<{
      name?: string; meetingUri?: string; meetingCode?: string;
    }>({ url: "https://meet.googleapis.com/v2/spaces", method: "POST", data: {} });
    if (!response.data.name || !response.data.meetingUri) {
      throw new Error("Google did not return a Meet URL.");
    }
    return {
      spaceName: response.data.name,
      meetingUri: response.data.meetingUri,
      meetingCode: response.data.meetingCode || "",
    };
  } catch (error: any) {
    const status = error?.response?.status;
    const message = error?.response?.data?.error?.message;
    if (status === 403) throw new Error("Google Meet API permission denied. Enable Google Meet API and reconnect the Google account with meetings.space.created scope.");
    if (status === 401) throw new Error("Google authorization expired. Reconnect Google in Workspace Settings.");
    throw new Error(message || error?.message || "Unable to create Google Meet.");
  }
}

/**
 * Creates a scheduled Google Calendar event and asks Google Calendar to generate
 * its conference link. This keeps the Meet link attached to the calendar event.
 */
export async function createGoogleCalendarEvent(args: {
  userId: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  attendeeEmails?: string[];
}) {
  const auth = await getGoogleClient(args.userId);
  const calendar = google.calendar({ version: "v3", auth });
  const response = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary: args.title,
      description: args.description || "",
      start: { dateTime: args.start.toISOString() },
      end: { dateTime: args.end.toISOString() },
      attendees: [...new Set(args.attendeeEmails || [])]
        .filter((email) => email && email.includes("@"))
        .map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });
  const entry = response.data.conferenceData?.entryPoints?.find(
    (point) => point.entryPointType === "video",
  );
  return {
    googleEventId: response.data.id || "",
    googleCalendarId: "primary",
    googleHtmlLink: response.data.htmlLink || "",
    googleMeetLink: entry?.uri || "",
  };
}

export async function updateGoogleCalendarEvent(args: {
  userId: string; eventId: string; title: string; description?: string;
  start: Date; end: Date;
}) {
  const auth = await getGoogleClient(args.userId);
  const calendar = google.calendar({ version: "v3", auth });
  const response = await calendar.events.patch({
    calendarId: "primary",
    eventId: args.eventId,
    sendUpdates: "all",
    requestBody: {
      summary: args.title,
      description: args.description || "",
      start: { dateTime: args.start.toISOString() },
      end: { dateTime: args.end.toISOString() },
    },
  });
  return { googleHtmlLink: response.data.htmlLink || "" };
}

export async function deleteGoogleCalendarEvent(userId: string, eventId: string) {
  const auth = await getGoogleClient(userId);
  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.delete({ calendarId: "primary", eventId, sendUpdates: "all" });
}
