import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE } from "@/lib/auth";

const PUBLIC_ROUTES = ["/login", "/forgot-password", "/reset-password"];

const PUBLIC_API_ROUTES = [
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

export async function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;

  // Allow public authentication pages and password recovery APIs.
  if (PUBLIC_ROUTES.includes(p) || PUBLIC_API_ROUTES.includes(p)) {
    return NextResponse.next();
  }

  const s = await verifyToken(req.cookies.get(COOKIE)?.value);

  if (!s) {
    return p.startsWith("/api")
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.url));
  }

  // Admin-only access.
  if (
    (p.startsWith("/admin") || p.startsWith("/api/admin")) &&
    s.role !== "admin"
  ) {
    return p.startsWith("/api")
      ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
      : NextResponse.redirect(new URL("/drive", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
