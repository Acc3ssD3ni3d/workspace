import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { GoogleConnection, User } from "@/lib/models";
import { getGoogleOAuthClient } from "@/lib/google-oauth";
import { encryptGoogleToken } from "@/lib/google-crypto";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const clearStateCookie = (response: NextResponse) => {
    response.cookies.set("google_oauth_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api",
      maxAge: 0,
    });

    return response;
  };

  try {
    // 1. Verify existing Workspace login
    const session = await getSession();

    if (!session) {
      return clearStateCookie(
        NextResponse.redirect(
          new URL("/login?error=workspace_session_expired", request.url),
        ),
      );
    }

    const params = request.nextUrl.searchParams;

    // 2. Handle Google authorization cancellation/errors
    const googleError = params.get("error");

    if (googleError) {
      return clearStateCookie(
        NextResponse.redirect(
          new URL(
            `/?google=error&reason=${encodeURIComponent(googleError)}`,
            request.url,
          ),
        ),
      );
    }

    const code = params.get("code");
    const returnedState = params.get("state");
    const savedState = request.cookies.get("google_oauth_state")?.value;

    // 3. Verify OAuth state
    if (
      !code ||
      !returnedState ||
      !savedState ||
      returnedState !== savedState
    ) {
      return clearStateCookie(
        NextResponse.redirect(new URL("/?google=invalid_state", request.url)),
      );
    }

    await connectDB();

    // 4. Verify employee account
    const user = await User.findById(session.sub).select("_id active email");

    if (!user || !user.active) {
      return clearStateCookie(
        NextResponse.redirect(
          new URL("/?google=account_unavailable", request.url),
        ),
      );
    }

    // 5. Exchange authorization code for tokens
    const client = getGoogleOAuthClient();

    const { tokens } = await client.getToken(code);

    if (!tokens.access_token) {
      throw new Error("Google did not return an access token.");
    }

    client.setCredentials(tokens);

    // 6. Retrieve connected Google account
    const oauth2 = google.oauth2({
      version: "v2",
      auth: client,
    });

    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.id || !profile.email) {
      throw new Error("Unable to retrieve Google account information.");
    }

    // 7. Preserve existing refresh token when Google
    // does not return a new one.
    const existing = await GoogleConnection.findOne({
      user: session.sub,
    }).select("+refreshTokenEncrypted");

    const update: Record<string, unknown> = {
      googleId: profile.id,
      email: profile.email,
      accessTokenEncrypted: encryptGoogleToken(tokens.access_token),
      tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: tokens.scope ? tokens.scope.split(" ") : [],
      connectedAt: new Date(),
    };

    if (tokens.refresh_token) {
      update.refreshTokenEncrypted = encryptGoogleToken(tokens.refresh_token);
    } else if (!existing?.refreshTokenEncrypted) {
      throw new Error(
        "Google did not provide a refresh token. Please revoke the previous app access and reconnect.",
      );
    }

    // 8. Save encrypted Google credentials
    await GoogleConnection.findOneAndUpdate(
      { user: session.sub },
      {
        $set: update,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    // 9. Return employee to Workspace
    return clearStateCookie(
      NextResponse.redirect(new URL("/?google=connected", request.url)),
    );
  } catch (error) {
    console.error("Google OAuth callback error:", error);

    return clearStateCookie(
      NextResponse.redirect(new URL("/?google=connection_failed", request.url)),
    );
  }
}
