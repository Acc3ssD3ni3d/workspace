import { google } from "googleapis";

export const GOOGLE_SCOPES = [
  // Google account identification
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",

  // Google Docs
  "https://www.googleapis.com/auth/documents",

  // Google Sheets
  "https://www.googleapis.com/auth/spreadsheets",

  // Access files created or opened by this application
  "https://www.googleapis.com/auth/drive.file",

  // Google Calendar
  "https://www.googleapis.com/auth/calendar.events",

  // Google Meet
  "https://www.googleapis.com/auth/meetings.space.created",

  // Google Chat: list spaces and send messages as the connected user
  "https://www.googleapis.com/auth/chat.spaces.readonly",
  "https://www.googleapis.com/auth/chat.messages.create",
  "https://www.googleapis.com/auth/chat.messages.readonly",
];

export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth environment variables are missing.");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthorizationUrl(state: string) {
  const client = getGoogleOAuthClient();

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: GOOGLE_SCOPES,
    state,
  });
}
