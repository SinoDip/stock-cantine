import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_DAYS, createSessionToken, safeEqual } from "@/lib/auth";

export async function POST(req: Request) {
  const expected = process.env.TEAM_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "TEAM_PASSWORD is niet ingesteld op de server." }, { status: 500 });
  }
  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    /* lege body */
  }
  // Kleine vertraging maakt raden trager.
  await new Promise((r) => setTimeout(r, 400));
  if (!safeEqual(password, expected)) {
    return NextResponse.json({ error: "Dat wachtwoord klopt niet." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return res;
}
