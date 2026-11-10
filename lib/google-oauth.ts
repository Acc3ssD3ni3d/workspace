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

  // Google Drive
  "https://www.googleapis.com/auth/drive.file",

  // Google Calendar
  "https://www.googleapis.com/auth/calendar.events",

  // Google Meet
  "https://www.googleapis.com/auth/meetings.space.created",

  // Google Chat
  "https://www.googleapis.com/auth/chat.spaces.readonly",
  "https://www.googleapis.com/auth/chat.messages.create",
  "https://www.googleapis.com/auth/chat.messages.readonly",
];

const PRODUCTION_APP_URL = "https://workspace.eduoneinternational.com";

function getRedirectUri(): string {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!redirectUri) {
    throw new Error("GOOGLE_REDIRECT_URI is not configured.");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(redirectUri);
  } catch {
    throw new Error("GOOGLE_REDIRECT_URI must be a valid URL.");
  }

  if (
    process.env.NODE_ENV === "production" &&
    parsedUrl.origin !== PRODUCTION_APP_URL
  ) {
    throw new Error(
      "Google OAuth redirect URI must use the production Workspace domain.",
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    parsedUrl.protocol !== "https:"
  ) {
    throw new Error("Google OAuth requires HTTPS in production.");
  }

  return redirectUri;
}

export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth client credentials are missing.");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthorizationUrl(state: string) {
  if (!state) {
    throw new Error("Google OAuth state is required.");
  }

  const client = getGoogleOAuthClient();

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: GOOGLE_SCOPES,
    state,
  });
}
