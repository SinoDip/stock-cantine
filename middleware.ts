import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Alles achter het teamwachtwoord, behalve de loginpagina zelf.
export async function middleware(req: NextRequest) {
  const okSession = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (okSession) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Je bent niet ingelogd." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
