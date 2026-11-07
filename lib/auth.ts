import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
export const COOKIE = "ew_session";
export type Session = { sub: string; name: string; role: "admin" | "member" };
const key = () => new TextEncoder().encode(process.env.AUTH_SECRET);
export const signSession = (s: Session) => new SignJWT({ ...s }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(key());
export async function verifyToken(t?: string): Promise<Session | null> {
  if (!t) return null;
  try { return (await jwtVerify(t, key())).payload as unknown as Session; } catch { return null; }
}
export const getSession = () => verifyToken(cookies().get(COOKIE)?.value);
