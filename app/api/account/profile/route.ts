import { guard, J } from "@/lib/http";
import { User } from "@/lib/models";

export const runtime = "nodejs";

/* ==========================================================================
   MY PROFILE (any signed-in user)
   GET    -> { name, email, personalEmail, role }
   PATCH  { personalEmail }
   The personal email receives calendar / meeting emails and password resets.
   Employees get one from the admin at onboarding; admins add their own here.
   ========================================================================== */
export const GET = guard(async (_req, s) => {
  const user: any = await User.findById(s.sub).select("name email personalEmail role").lean();
  if (!user) throw new Error("Account not found.");

  return J({
    name: user.name,
    email: user.email,
    personalEmail: user.personalEmail || "",
    role: user.role,
  });
});

export const PATCH = guard(async (req, s) => {
  const body = await req.json();
  const personalEmail = String(body.personalEmail ?? "").trim().toLowerCase();

  if (personalEmail) {
    if (personalEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
      throw new Error("Enter a valid email address.");
    }

    // A personal email cannot be a company address of another account.
    const clash = await User.exists({ _id: { $ne: s.sub }, email: personalEmail });
    if (clash) throw new Error("That address is already used as a company email.");
  }

  await User.updateOne({ _id: s.sub }, { $set: { personalEmail } });

  return J({
    ok: true,
    personalEmail,
    message: personalEmail ? "Personal email saved." : "Personal email removed.",
  });
});
