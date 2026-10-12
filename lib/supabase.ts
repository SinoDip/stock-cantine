import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export class ConfigError extends Error {}

/** Supabase met de geheime sleutel. Alleen op de server gebruiken. */
export function supabase(): SupabaseClient {
  if (client) return client;
  // Opkuisen wat vaak misgaat bij plakken: spaties, regeleinden, aanhalingstekens, "/rest/v1" achter de URL.
  const rawUrl = (process.env.SUPABASE_URL ?? "").trim().replace(/^["']|["']$/g, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim().replace(/^["']|["']$/g, "");
  if (!rawUrl) throw new ConfigError("SUPABASE_URL ontbreekt in Vercel (Settings → Environment Variables).");
  if (!key) throw new ConfigError("SUPABASE_SERVICE_ROLE_KEY ontbreekt in Vercel (Settings → Environment Variables).");
  const url = rawUrl.replace(/\/+$/, "").replace(/\/rest\/v1$/, "").replace(/\/+$/, "");
  if (!/^https:\/\/[^/]+$/.test(url)) {
    throw new ConfigError(`SUPABASE_URL ziet er niet goed uit ("${url}"). Het moet zoiets zijn als https://abcdefgh.supabase.co`);
  }
  if (key.startsWith("sb_publishable_")) {
    throw new ConfigError("In SUPABASE_SERVICE_ROLE_KEY staat de publishable key. Gebruik de secret key (begint met sb_secret_).");
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
