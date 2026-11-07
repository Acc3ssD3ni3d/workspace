import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { signSession, COOKIE } from "@/lib/auth";
import { J } from "@/lib/http";
export async function POST(req: Request) {
  const { email, password } = await req.json(); await connectDB();
  const u = await User.findOne({ email: String(email).toLowerCase().trim(), active: true });
  if (!u || !(await bcrypt.compare(String(password), u.passwordHash))) return J({ error: "Wrong email or password" }, 401);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await signSession({ sub: String(u._id), name: u.name, role: u.role }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 604800 });
  return res;
}
