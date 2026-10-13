import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ALLERGENS, AREAS, isArea } from "./stock";
import { ConfigError } from "./supabase";
import type { Area, Batch, BatchInput, LogAction, LogEntry, Product, ProductInput, Supplier, SupplierInput } from "./types";

/* ---------- rijen uit de database → app-objecten ---------- */

type ProductRow = {
  id: string;
  name: string;
  category: string;
  unit: string;
  min: number | string | null;
  location: string | null;
  prep: boolean;
  shelf_days: number | null;
  supplier_id: string | null;
  price: number | string | null;
  allergens: string[] | null;
  areas: string[] | null;
};

type BatchRow = {
  id: string;
  product_id: string;
  qty: number | string;
  remaining: number | string;
  area: string | null;
  received: string;
  expires: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

type SupplierRow = {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  customer_number: string | null;
  order_days: number[] | null;
  order_deadline: string | null;
  delivery_days: number[] | null;
  notes: string | null;
};

type LogRow = {
  id: number | string;
  created_at: string;
  who: string | null;
  action: string;
  product_id: string | null;
  product_name: string | null;
  qty: number | string | null;
  detail: string | null;
};

export const PRODUCT_COLS = "id,name,category,unit,min,location,prep,shelf_days,supplier_id,price,allergens,areas";
export const BATCH_COLS = "id,product_id,qty,remaining,area,received,expires,note,created_by,created_at";
export const SUPPLIER_COLS = "id,name,contact,phone,email,customer_number,order_days,order_deadline,delivery_days,notes";
export const LOG_COLS = "id,created_at,who,action,product_id,product_name,qty,detail";

function toAreas(v: unknown): Area[] {
  const list = Array.isArray(v) ? AREAS.filter((a) => v.includes(a)) : [];
  return list.length ? list : ["keuken"];
}

export function toProduct(r: ProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    unit: r.unit,
    min: r.min == null ? null : Number(r.min),
    location: r.location,
    prep: !!r.prep,
    shelfDays: r.shelf_days,
    supplierId: r.supplier_id ?? null,
    price: r.price == null ? null : Number(r.price),
    allergens: r.allergens ?? [],
    areas: toAreas(r.areas),
  };
}

export function toBatch(r: BatchRow): Batch {
  return {
    id: r.id,
    productId: r.product_id,
    qty: Number(r.qty),
    remaining: Number(r.remaining),
    area: isArea(r.area) ? r.area : "keuken",
    received: r.received,
    expires: r.expires,
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

export function toSupplier(r: SupplierRow): Supplier {
  return {
    id: r.id,
    name: r.name,
    contact: r.contact,
    phone: r.phone,
    email: r.email,
    customerNumber: r.customer_number,
    orderDays: (r.order_days ?? []).map(Number),
    orderDeadline: r.order_deadline,
    deliveryDays: (r.delivery_days ?? []).map(Number),
    notes: r.notes,
  };
}

export function toLog(r: LogRow): LogEntry {
  return {
    id: Number(r.id),
    createdAt: r.created_at,
    who: r.who,
    action: r.action as LogAction,
    productId: r.product_id,
    productName: r.product_name,
    qty: r.qty == null ? null : Number(r.qty),
    detail: r.detail,
  };
}

/* ---------- invoer controleren ---------- */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

export class InputError extends Error {}

function str(v: unknown, field: string, max = 120): string {
  if (typeof v !== "string" || !v.trim()) throw new InputError(`${field} ontbreekt.`);
  return v.trim().slice(0, max);
}
function optStr(v: unknown, max = 200): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}
function optNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new InputError("Ongeldig getal.");
  return n;
}
function optDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !DATE.test(v)) throw new InputError("Ongeldige datum.");
  return v;
}
function days(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort();
}

export function parseProduct(body: Record<string, unknown>): ProductInput {
  const prep = body.prep === true;
  const shelf = optNum(body.shelfDays);
  const allergens = Array.isArray(body.allergens) ? body.allergens.filter((a): a is string => typeof a === "string" && ALLERGENS.includes(a)) : [];
  return {
    name: str(body.name, "Naam"),
    category: optStr(body.category, 60) ?? "Overige",
    unit: optStr(body.unit, 30) ?? "stuks",
    min: optNum(body.min),
    location: optStr(body.location, 40),
    prep,
    shelfDays: prep && shelf ? Math.max(1, Math.round(shelf)) : null,
    supplierId: optStr(body.supplierId, 80),
    price: optNum(body.price),
    allergens: [...new Set(allergens)],
    areas: parseAreas(body.areas),
  };
}

function parseAreas(v: unknown): Area[] {
  const list = Array.isArray(v) ? AREAS.filter((a) => v.includes(a)) : [];
  if (!list.length) throw new InputError("Kies Keuken, Front of allebei.");
  return list;
}

export function parseArea(v: unknown): Area {
  if (!isArea(v)) throw new InputError("Kies Keuken of Front.");
  return v;
}

export function productRow(p: ProductInput) {
  return {
    name: p.name,
    category: p.category,
    unit: p.unit,
    min: p.min,
    location: p.location,
    prep: p.prep,
    shelf_days: p.shelfDays,
    supplier_id: p.supplierId,
    price: p.price,
    allergens: p.allergens,
    areas: p.areas,
  };
}

export function parseSupplier(body: Record<string, unknown>): SupplierInput {
  const deadline = optStr(body.orderDeadline, 5);
  if (deadline && !TIME.test(deadline)) throw new InputError("Schrijf de deadline als uu:mm, bv. 14:00.");
  return {
    name: str(body.name, "Naam", 80),
    contact: optStr(body.contact, 80),
    phone: optStr(body.phone, 40),
    email: optStr(body.email, 120),
    customerNumber: optStr(body.customerNumber, 60),
    orderDays: days(body.orderDays),
    orderDeadline: deadline,
    deliveryDays: days(body.deliveryDays),
    notes: optStr(body.notes, 1000),
  };
}

export function supplierRow(s: SupplierInput) {
  return {
    name: s.name,
    contact: s.contact,
    phone: s.phone,
    email: s.email,
    customer_number: s.customerNumber,
    order_days: s.orderDays,
    order_deadline: s.orderDeadline,
    delivery_days: s.deliveryDays,
    notes: s.notes,
  };
}

export function parseBatch(body: Record<string, unknown>): BatchInput {
  const qty = optNum(body.qty);
  if (!qty || qty <= 0) throw new InputError("Vul een aantal groter dan 0 in.");
  return {
    productId: str(body.productId, "Product", 80),
    area: parseArea(body.area),
    qty,
    received: optDate(body.received) ?? new Date().toISOString().slice(0, 10),
    expires: optDate(body.expires),
    note: optStr(body.note),
    createdBy: optStr(body.createdBy, 60),
  };
}

export { optDate, optNum };

/* ---------- logboek ---------- */

/** Naam van wie de wijziging doet (meegestuurd door de app). */
export function whoFrom(req: Request): string | null {
  const raw = req.headers.get("x-user-name");
  if (!raw) return null;
  try {
    return decodeURIComponent(raw).trim().slice(0, 40) || null;
  } catch {
    return null;
  }
}

export async function productName(db: SupabaseClient, id: string): Promise<string | null> {
  const { data } = await db.from("products").select("name").eq("id", id).maybeSingle();
  return (data as { name?: string } | null)?.name ?? null;
}

/** Schrijft een regel in het logboek. Een fout hier mag de actie zelf nooit tegenhouden. */
export async function logActivity(
  db: SupabaseClient,
  req: Request,
  entry: { action: LogAction; productId?: string | null; productName?: string | null; qty?: number | null; detail?: string | null },
) {
  try {
    const { error } = await db.from("activity_log").insert({
      who: whoFrom(req),
      action: entry.action,
      product_id: entry.productId ?? null,
      product_name: entry.productName ?? null,
      qty: entry.qty ?? null,
      detail: entry.detail ?? null,
    });
    if (error) console.error("logboek:", error.message);
  } catch (e) {
    console.error("logboek:", e);
  }
}

/* ---------- antwoorden ---------- */

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(err: unknown) {
  if (err instanceof InputError) return NextResponse.json({ error: err.message }, { status: 400 });
  const e = err as { code?: string; message?: string };
  if (e?.code === "23505") return NextResponse.json({ error: "Deze naam bestaat al." }, { status: 409 });
  if (e?.code === "23503") return NextResponse.json({ error: "Dit product of deze leverancier bestaat niet meer." }, { status: 409 });
  console.error(err);
  return NextResponse.json({ error: explain(err) }, { status: 500 });
}

/** Zet een databasefout om in een uitleg die je zelf kunt oplossen. */
function explain(err: unknown): string {
  if (err instanceof ConfigError) return err.message;
  const e = (err ?? {}) as { code?: string; message?: string; details?: string; hint?: string };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`.trim();
  const tech = msg ? ` (technisch: ${msg.slice(0, 200)})` : "";
  const m = msg.toLowerCase();
  if (m.includes("invalid api key") || m.includes("jwt") || m.includes("unauthorized") || e.code === "PGRST301" || e.code === "401")
    return `De Supabase-sleutel klopt niet. Kopieer de secret key opnieuw uit Supabase (Project Settings → API Keys) naar SUPABASE_SERVICE_ROLE_KEY in Vercel en klik op Redeploy.${tech}`;
  if (m.includes("fetch failed") || m.includes("enotfound") || m.includes("getaddrinfo") || m.includes("network"))
    return `Supabase is niet bereikbaar. Klopt SUPABASE_URL in Vercel (bv. https://abcdefgh.supabase.co)? Staat je Supabase-project niet op pauze?${tech}`;
  if (e.code === "42P01" || e.code === "PGRST205" || m.includes("could not find the table") || (m.includes("relation") && m.includes("does not exist")))
    return `Een tabel ontbreekt in de database. Voer supabase/schema.sql uit in de SQL Editor van Supabase.${tech}`;
  if (e.code === "42703" || e.code === "PGRST204" || m.includes("column") || m.includes("schema cache"))
    return `Een kolom ontbreekt in de database. Voer supabase/update-1.sql en supabase/update-2.sql uit in de SQL Editor van Supabase.${tech}`;
  if (e.code === "42883" || e.code === "PGRST202" || m.includes("function"))
    return `Een databasefunctie ontbreekt. Voer supabase/update-2.sql uit in de SQL Editor van Supabase.${tech}`;
  return `Er ging iets mis op de server.${tech}`;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const j = await req.json();
    return j && typeof j === "object" ? (j as Record<string, unknown>) : {};
  } catch {
    throw new InputError("Ongeldige aanvraag.");
  }
}
