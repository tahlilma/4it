import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: send visitors without a session cookie to the sign-in page.
// Every page, server action and route handler still verifies the session and permissions itself.
export function proxy(req: NextRequest) {
  if (req.cookies.has("hrp_session")) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|login).*)"],
};
