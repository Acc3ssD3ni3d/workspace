import { NextResponse } from "next/server";
import { getSession, Session } from "./auth";
import { connectDB } from "./db";
import { User } from "./models";
export const J = (d: any, status = 200) => NextResponse.json(d, { status });
// Wraps every API route: session check, optional admin-only, disabled-account check, error handling
export const guard = (h: (req: Request, s: Session, ctx: any) => Promise<Response>, admin = false) => async (req: Request, ctx: any) => {
  const s = await getSession();
  if (!s) return J({ error: "Unauthorized" }, 401);
  if (admin && s.role !== "admin") return J({ error: "Forbidden" }, 403);
  try {
    await connectDB();
    if (!(await User.exists({ _id: s.sub, active: true }))) return J({ error: "Account disabled" }, 401);
    return await h(req, s, ctx);
  } catch (e: any) { return J({ error: e.message || "Error" }, 400); }
};
