import { NextResponse, type NextRequest } from "next/server";
import { missingEnv, SESSION_COOKIE, verifySessionToken } from "@/lib/server/session";

// Everything except the login page, the setup guide and static assets needs a session.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/setup") return NextResponse.next();

  // Fresh deployment with no database or password yet: show the setup guide instead of an error
  if (missingEnv().length) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "not set up" }, { status: 503 });
    return NextResponse.redirect(new URL("/setup", request.url));
  }
  if (pathname === "/login") return NextResponse.next();
  if (verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  const next = pathname + search;
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|mark\\.svg|robots\\.txt).*)"],
};
