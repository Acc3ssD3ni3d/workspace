import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { GoogleConnection } from "@/lib/models";
import { getGoogleOAuthClient } from "@/lib/google-oauth";
import { decryptGoogleToken } from "@/lib/google-crypto";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    await connectDB();

    const connection = await GoogleConnection.findOne({
      user: session.sub,
    }).select("email googleId scopes connectedAt");

    return NextResponse.json({
      connected: Boolean(connection),
      account: connection
        ? {
            email: connection.email,
            connectedAt: connection.connectedAt,
            scopes: connection.scopes,
          }
        : null,
    });
  } catch (error) {
    console.error("Google connection status error:", error);

    return NextResponse.json(
      { error: "Unable to check Google connection." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    await connectDB();

    const connection = await GoogleConnection.findOne({
      user: session.sub,
    }).select("+refreshTokenEncrypted");

    if (!connection) {
      return NextResponse.json({
        success: true,
        connected: false,
      });
    }

    if (connection.refreshTokenEncrypted) {
      try {
        const client = getGoogleOAuthClient();

        const refreshToken = decryptGoogleToken(
          connection.refreshTokenEncrypted,
        );

        await client.revokeToken(refreshToken);
      } catch (error) {
        console.error("Google token revocation failed:", error);
      }
    }

    await GoogleConnection.deleteOne({
      _id: connection._id,
      user: session.sub,
    });

    return NextResponse.json({
      success: true,
      connected: false,
    });
  } catch (error) {
    console.error("Google disconnect error:", error);

    return NextResponse.json(
      { error: "Unable to disconnect Google account." },
      { status: 500 },
    );
  }
}
