import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs";

const GENERIC_MESSAGE =
  "If an active account matches that email and has a personal email registered, a password reset link will be sent shortly.";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();

    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid company email address." }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ email, active: true }).select("+passwordResetRequestedAt");

    // Do not reveal whether an account exists. Apply a 60-second cooldown per account.
    if (!user || !user.personalEmail) {
      return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
    }

    const now = Date.now();
    const lastRequested = user.passwordResetRequestedAt
      ? new Date(user.passwordResetRequestedAt).getTime()
      : 0;

    if (now - lastRequested < 60_000) {
      return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpiresAt = new Date(now + 30 * 60 * 1000);
    user.passwordResetRequestedAt = new Date(now);
    await user.save();

    const configuredBaseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!configuredBaseUrl) {
      user.passwordResetTokenHash = "";
      user.passwordResetExpiresAt = null;
      await user.save();
      console.error("APP_URL is not configured; password reset email was not sent.");
      return NextResponse.json({ error: "Password recovery is not configured yet." }, { status: 503 });
    }
    const baseUrl = configuredBaseUrl.replace(/\/$/, "");
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    try {
      await sendPasswordResetEmail({
        name: user.name,
        personalEmail: user.personalEmail,
        resetUrl,
      });
    } catch (emailError) {
      // Invalidate the token if delivery failed; never log the raw token or reset URL.
      user.passwordResetTokenHash = "";
      user.passwordResetExpiresAt = null;
      await user.save();
      console.error("Password reset email delivery failed:", emailError);
      // Keep the public response identical so account existence is not disclosed.
      return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
    }

    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("Forgot password request failed:", error);
    return NextResponse.json({ error: "Unable to process the request right now." }, { status: 500 });
  }
}
