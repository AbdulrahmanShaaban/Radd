import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/login")) {
    return hasSessionCookie
      ? NextResponse.redirect(new URL("/inbox", request.url))
      : NextResponse.next();
  }

  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/inbox/:path*",
    "/kb/:path*",
    "/calendar/:path*",
    "/analytics/:path*",
    "/settings/:path*",
    "/login",
  ],
};
