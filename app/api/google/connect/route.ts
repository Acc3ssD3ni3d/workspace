import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { getGoogleAuthorizationUrl } from "@/lib/google-oauth";

export const runtime = "nodejs";

export async function GET() {
  try {
    // 1. Verify existing Workspace login
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Please log in to your Workspace first." },
        { status: 401 },
      );
    }

    // 2. Verify employee account
    await connectDB();

    const user = await User.findById(session.sub).select("_id active email");

    if (!user || !user.active) {
      return NextResponse.json(
        { error: "Your Workspace account is inactive or unavailable." },
        { status: 403 },
      );
    }

    // 3. Generate secure OAuth state
    const state = randomBytes(32).toString("hex");

    // 4. Generate Google authorization URL
    const authorizationUrl = getGoogleAuthorizationUrl(state);

    // 5. Redirect employee to Google sign-in
    const response = NextResponse.redirect(authorizationUrl);

    // 6. Store OAuth state securely for callback verification
    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api",
      maxAge: 600,
    });

    return response;
  } catch (error) {
    console.error("Google connection error:", error);

    return NextResponse.json(
      { error: "Unable to start Google account connection." },
      { status: 500 },
    );
  }
}
