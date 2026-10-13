import type { Area, Batch, Product, Settings } from "./types";

/** Vaste volgorde van de categorieën. Voeg hier gerust een categorie toe. */
export const CATEGORIES = [
  "Groenten & fruit",
  "Kruiden",
  "Vlees & vis",
  "Zuivel & eieren",
  "Sauzen & smaak",
  "Prep",
  "Overige",
];

export const LOCATIONS = ["Koelcel", "Diepvries", "Droge stock", "Bar"];

export const AREAS: Area[] = ["keuken", "front"];
export const AREA_LABEL: Record<Area, string> = { keuken: "Keuken", front: "Front" };

export function isArea(v: unknown): v is Area {
  return v === "keuken" || v === "front";
}

/** De 14 allergenen die je volgens de Europese regels moet melden. */
export const ALLERGENS = [
  "Gluten",
  "Schaaldieren",
  "Eieren",
  "Vis",
  "Pinda's",
  "Soja",
  "Melk",
  "Noten",
  "Selderij",
  "Mosterd",
  "Sesamzaad",
  "Sulfiet",
  "Lupine",
  "Weekdieren",
];

/** Index 0 = maandag (ISO-dag 1). */
export const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];
export const WEEKDAYS_LONG = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

/** 1 = maandag … 7 = zondag */
export function isoWeekday(d = new Date()): number {
  return ((d.getDay() + 6) % 7) + 1;
}

export function fmtDays(days: number[]): string {
  return [...days].sort((a, b) => a - b).map((d) => WEEKDAYS[d - 1]).join(", ");
}

export function fmtMoney(n: number): string {
  return n.toLocaleString("nl-BE", { style: "currency", currency: "EUR" });
}

/** Minuten tot een deadline "HH:MM" vandaag (negatief = voorbij). */
export function minutesUntil(deadline: string, now = new Date()): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(deadline);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]) - (now.getHours() * 60 + now.getMinutes());
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}u${m ? ` ${m}m` : ""}` : `${m}m`;
}

const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Datum in de lokale tijdzone als YYYY-MM-DD. */
export function localISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return localISO(new Date());
}

function toUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const t = new Date(toUTC(iso) + n * 864e5);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Aantal dagen van a tot b (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 864e5);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const year = y !== new Date().getFullYear() ? ` '${String(y).slice(2)}` : "";
  return `${d} ${MONTHS[m - 1]}${year}`;
}

export function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString("nl-BE", { maximumFractionDigits: 2 });
}

/** Kleine letters en zonder accenten, om te zoeken. */
export function norm(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function relDays(n: number): string {
  if (n < -1) return `${-n} dagen over datum`;
  if (n === -1) return "gisteren vervallen";
  if (n === 0) return "vervalt vandaag";
  if (n === 1) return "vervalt morgen";
  return `nog ${n} dagen`;
}

export function longDate(d = new Date()): string {
  return d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
}

/** Eerst wat het eerst vervalt, dan wat het eerst binnenkwam. */
export function fifo(a: Batch, b: Batch): number {
  const ea = a.expires ?? "9999-12-31";
  const eb = b.expires ?? "9999-12-31";
  if (ea !== eb) return ea < eb ? -1 : 1;
  if (a.received !== b.received) return a.received < b.received ? -1 : 1;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

export function groupBatches(batches: Batch[]): Map<string, Batch[]> {
  const map = new Map<string, Batch[]>();
  for (const b of batches) {
    if (b.remaining <= 0) continue;
    const list = map.get(b.productId);
    if (list) list.push(b);
    else map.set(b.productId, [b]);
  }
  for (const list of map.values()) list.sort(fifo);
  return map;
}

export type LowState = "op" | "laag" | "ok";
export type ExpiryState = "vervallen" | "binnenkort" | null;

export type ProductInfo = {
  batches: Batch[];
  total: number;
  next: Batch | undefined;
  days: number | null;
  low: LowState;
  expiry: ExpiryState;
};

export function productInfo(p: Product, batches: Batch[], settings: Settings): ProductInfo {
  const total = batches.reduce((s, b) => s + b.remaining, 0);
  const next = batches.find((b) => b.expires);
  const days = next?.expires ? daysBetween(todayISO(), next.expires) : null;
  const low: LowState = total <= 0 ? "op" : p.min != null && total <= p.min ? "laag" : "ok";
  const expiry: ExpiryState = days == null ? null : days < 0 ? "vervallen" : days <= settings.warnDays ? "binnenkort" : null;
  return { batches, total, next, days, low, expiry };
}

export function needsOrder(p: Product, info: ProductInfo): boolean {
  return p.min != null && info.low !== "ok";
}

/** Voorstel: aanvullen tot twee keer het minimum. */
export function suggestOrder(p: Product, total: number): number {
  const m = p.min ?? 1;
  return Math.max(1, Math.ceil(m * 2 - total));
}

export function categoryRank(c: string): number {
  const i = CATEGORIES.indexOf(c);
  return i < 0 ? 100 : i;
}

export function byCategory(a: string, b: string): number {
  return categoryRank(a) - categoryRank(b) || a.localeCompare(b, "nl");
}

export function byName(a: Product, b: Product): number {
  return a.name.localeCompare(b.name, "nl");
}
