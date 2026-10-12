// Werkt zowel in middleware (edge) als in API-routes (node): alleen Web Crypto.

export const SESSION_COOKIE = "sc_session";
export const SESSION_DAYS = 90;

const enc = new TextEncoder();

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET ontbreekt of is korter dan 32 tekens.");
  return s;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** Vergelijkt twee teksten zonder vroeg te stoppen. */
export function safeEqual(a: string, b: string): boolean {
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ba.length ^ bb.length;
  const len = Math.max(ba.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_DAYS * 864e5;
  const payload = `team.${expires}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [who, exp, sig] = parts;
  const expires = Number(exp);
  if (who !== "team" || !Number.isFinite(expires) || expires < Date.now()) return false;
  try {
    return safeEqual(sig, await sign(`${who}.${exp}`));
  } catch {
    return false;
  }
}
