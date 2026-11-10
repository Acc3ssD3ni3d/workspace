import { guard, J } from "@/lib/http";
import { User } from "@/lib/models";

/* ==========================================================================
   ADMIN ONLY - who may edit the Organisation calendar.
   GET    -> every active member with a flag  { orgCalendarEditor }
   PATCH  { userId, enabled }
   Administrators can always edit, so they are listed but cannot be toggled.
   ========================================================================== */
export const GET = guard(async () => {
  const users: any[] = await User.find({ active: true })
    .select("name email role orgCalendarEditor")
    .sort({ name: 1 })
    .lean();

  return J(
    users.map((user) => ({
      _id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      orgCalendarEditor: user.role === "admin" ? true : Boolean(user.orgCalendarEditor),
    })),
  );
}, true);

export const PATCH = guard(async (req) => {
  const body = await req.json();
  const userId = String(body.userId || "");
  if (!/^[a-f0-9]{24}$/i.test(userId)) throw new Error("User is required.");
  if (typeof body.enabled !== "boolean") throw new Error("Choose on or off.");

  const user: any = await User.findOne({ _id: userId, active: true });
  if (!user) throw new Error("User not found.");
  if (user.role === "admin") throw new Error("Administrators can always edit the Organisation calendar.");

  user.orgCalendarEditor = body.enabled;
  await user.save();

  return J({ ok: true });
}, true);
