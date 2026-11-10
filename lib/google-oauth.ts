import { google } from "googleapis";

// ==========================================
// GOOGLE OAUTH SCOPES
// ==========================================

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

// ==========================================
// APPLICATION CONFIGURATION
// ==========================================

const PRODUCTION_APP_URL = "https://workspace.eduoneinternational.com";

function getAppBaseUrl(): URL {
  const appUrl = process.env.APP_URL;

  if (!appUrl) {
    throw new Error("APP_URL is not configured.");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(appUrl);
  } catch {
    throw new Error("APP_URL must be a valid URL.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("APP_URL must use HTTP or HTTPS.");
  }

  if (
    process.env.NODE_ENV === "production" &&
    parsedUrl.origin !== PRODUCTION_APP_URL
  ) {
    throw new Error(`Production APP_URL must be ${PRODUCTION_APP_URL}`);
  }

  if (
    process.env.NODE_ENV === "production" &&
    parsedUrl.protocol !== "https:"
  ) {
    throw new Error("Production APP_URL must use HTTPS.");
  }

  return parsedUrl;
}

// ==========================================
// APPLICATION REDIRECT URL
// Use this in the OAuth callback.
// ==========================================

export function getAppUrl(path = "/"): URL {
  const baseUrl = getAppBaseUrl();

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return new URL(normalizedPath, baseUrl.origin);
}

// ==========================================
// GOOGLE REDIRECT URI
// ==========================================

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

  const appUrl = getAppBaseUrl();

  if (parsedUrl.origin !== appUrl.origin) {
    throw new Error(
      "GOOGLE_REDIRECT_URI and APP_URL must use the same domain.",
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    parsedUrl.protocol !== "https:"
  ) {
    throw new Error("Google OAuth redirect URI must use HTTPS in production.");
  }

  if (parsedUrl.pathname !== "/api/auth/google/callback") {
    throw new Error(
      "GOOGLE_REDIRECT_URI must point to /api/auth/google/callback.",
    );
  }

  return redirectUri;
}

// ==========================================
// GOOGLE OAUTH CLIENT
// ==========================================

export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth client credentials are missing.");
  }

  const redirectUri = getRedirectUri();

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ==========================================
// GOOGLE AUTHORIZATION URL
// ==========================================

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
