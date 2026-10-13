"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Area, Batch, BatchInput, Product, ProductInput, Settings, StockData, Supplier, SupplierInput } from "@/lib/types";
import { AREA_LABEL, byName, groupBatches, isArea, needsOrder, productInfo, todayISO, daysBetween, type ProductInfo } from "@/lib/stock";
import { Icon, type IconName } from "./Icons";
import Today from "./Today";
import StockList from "./StockList";
import Inboeken from "./Inboeken";
import Bestellen from "./Bestellen";
import Meer, { type MeerView } from "./Meer";
import ProductSheet from "./ProductSheet";
import SupplierSheet from "./SupplierSheet";
import SettingsSheet from "./SettingsSheet";
import NamePrompt from "./NamePrompt";

export type Tab = "vandaag" | "stock" | "inboeken" | "bestellen" | "meer";
export type TabOptions = { pid?: string; supplierId?: string; view?: MeerView };
type SheetState =
  | { kind: "product"; pid: string | null; area?: Area }
  | { kind: "supplier"; id: string | null }
  | { kind: "settings" }
  | null;
type ToastState = { id: number; msg: string; actionLabel?: string; action?: () => void } | null;

type Ctx = {
  data: StockData;
  products: Product[];
  productMap: Map<string, Product>;
  suppliers: Supplier[];
  supplierMap: Map<string, Supplier>;
  /** Zonder kant: Keuken en Front samen. */
  infoOf: (p: Product, area?: Area) => ProductInfo;
  me: string;
  setMe: (name: string) => void;
  /** De kant die dit toestel laatst koos op de stockpagina. */
  area: Area;
  setArea: (a: Area) => void;
  goTab: (t: Tab, opts?: TabOptions) => void;
  openProduct: (pid: string | null, area?: Area) => void;
  openSupplier: (id: string | null) => void;
  openSettings: () => void;
  closeSheet: () => void;
  toast: (msg: string, actionLabel?: string, action?: () => void) => void;
  consumeOne: (pid: string, area: Area) => void;
  adjust: (b: Batch, delta: number) => void;
  restore: (b: Batch) => void;
  discard: (b: Batch) => void;
  setExpiry: (b: Batch, expires: string | null) => void;
  addBatch: (input: Omit<BatchInput, "createdBy">) => Promise<Batch | null>;
  removeBatch: (id: string) => void;
  saveProduct: (id: string | null, input: ProductInput) => Promise<Product | null>;
  deleteProduct: (id: string) => Promise<void>;
  saveSupplier: (id: string | null, input: SupplierInput) => Promise<Supplier | null>;
  deleteSupplier: (id: string) => Promise<void>;
  saveSettings: (s: Settings) => Promise<boolean>;
};

const StockContext = createContext<Ctx | null>(null);

export function useStock(): Ctx {
  const c = useContext(StockContext);
  if (!c) throw new Error("useStock buiten StockApp");
  return c;
}

const EMPTY: StockData = { products: [], batches: [], suppliers: [], settings: { warnDays: 3 } };
const NAME_KEY = "stocklijst.naam";
const AREA_KEY = "stocklijst.kant";

class ApiError extends Error {}

/** Naam van wie dit toestel gebruikt; gaat mee met elke aanvraag voor het logboek. */
let currentUser = "";

export async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (currentUser) headers["x-user-name"] = encodeURIComponent(currentUser);
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new ApiError("Je bent niet meer ingelogd.");
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(json.error ?? "Opslaan lukte niet. Probeer opnieuw.");
  return json;
}

export default function StockApp() {
  const [data, setData] = useState<StockData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("vandaag");
  const [tabOpts, setTabOpts] = useState<TabOptions>({});
  const [tabKey, setTabKey] = useState(0);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toastState, setToast] = useState<ToastState>(null);
  const [me, setMeState] = useState("");
  const [nameChecked, setNameChecked] = useState(false);
  const [area, setAreaState] = useState<Area>("keuken");

  // Bijhouden van lopende wijzigingen, zodat een trage refresh een snelle tik niet overschrijft.
  const pending = useRef(0);
  const seq = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  /* ---------- laden ---------- */
  const refresh = useCallback(async () => {
    const startSeq = seq.current;
    try {
      const d = await api<StockData>("/api/data");
      if (pending.current > 0 || seq.current !== startSeq) return;
      setData({ ...EMPTY, ...d });
      setLoaded(true);
      loadedRef.current = true;
      setLoadError(null);
    } catch (e) {
      if (!loadedRef.current) setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const id = setInterval(tick, 15000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [refresh]);

  useEffect(() => {
    let stored = "";
    try {
      stored = localStorage.getItem(NAME_KEY) ?? "";
    } catch {
      /* geen opslag beschikbaar */
    }
    currentUser = stored;
    setMeState(stored);
    setNameChecked(true);
    try {
      const a = localStorage.getItem(AREA_KEY);
      if (isArea(a)) setAreaState(a);
    } catch {
      /* geen opslag beschikbaar */
    }
  }, []);

  const setArea = useCallback((a: Area) => {
    setAreaState(a);
    try {
      localStorage.setItem(AREA_KEY, a);
    } catch {
      /* negeren */
    }
  }, []);

  const setMe = useCallback((name: string) => {
    currentUser = name;
    setMeState(name);
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      /* negeren */
    }
  }, []);

  /* ---------- afgeleide data ---------- */
  const byProduct = useMemo(() => groupBatches(data.batches), [data.batches]);
  const products = useMemo(() => [...data.products].sort(byName), [data.products]);
  const productMap = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);
  const suppliers = useMemo(() => [...data.suppliers].sort((a, b) => a.name.localeCompare(b.name, "nl")), [data.suppliers]);
  const supplierMap = useMemo(() => new Map(data.suppliers.map((s) => [s.id, s])), [data.suppliers]);
  const infoCache = useMemo(() => new Map<string, ProductInfo>(), [byProduct, data.settings, data.products]);
  const infoOf = useCallback(
    (p: Product, area?: Area) => {
      const key = area ? `${p.id}|${area}` : p.id;
      let i = infoCache.get(key);
      if (!i) {
        const all = byProduct.get(p.id) ?? [];
        i = productInfo(p, area ? all.filter((b) => b.area === area) : all, data.settings);
        infoCache.set(key, i);
      }
      return i;
    },
    [infoCache, byProduct, data.settings],
  );

  /* ---------- toast ---------- */
  const toast = useCallback((msg: string, actionLabel?: string, action?: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), msg, actionLabel, action });
    toastTimer.current = setTimeout(() => setToast(null), actionLabel ? 6000 : 3500);
  }, []);

  /* ---------- wijzigingen ---------- */
  const mutate = useCallback(
    async <T,>(optimistic: ((d: StockData) => StockData) | null, request: () => Promise<T>): Promise<T | null> => {
      seq.current++;
      pending.current++;
      if (optimistic) setData((d) => optimistic(d));
      try {
        return await request();
      } catch (e) {
        toast((e as Error).message || "Opslaan lukte niet. Probeer opnieuw.");
        return null;
      } finally {
        pending.current--;
        if (pending.current === 0) refresh();
      }
    },
    [refresh, toast],
  );

  const setBatchRemaining = (d: StockData, id: string, remaining: number): StockData => ({
    ...d,
    batches:
      remaining <= 0
        ? d.batches.filter((b) => b.id !== id)
        : d.batches.map((b) => (b.id === id ? { ...b, remaining, qty: Math.max(b.qty, remaining) } : b)),
  });

  const restore = useCallback(
    (b: Batch) => {
      mutate(
        (d) => ({ ...d, batches: [...d.batches.filter((x) => x.id !== b.id), b] }),
        () => api(`/api/batches/${encodeURIComponent(b.id)}`, "PUT", b),
      );
    },
    [mutate],
  );

  const consumeOne = useCallback(
    (pid: string, area: Area) => {
      const p = productMap.get(pid);
      const list = (byProduct.get(pid) ?? []).filter((b) => b.area === area);
      const first = list[0];
      if (!p || !first) return;
      const rest = list.reduce((s, b) => s + b.remaining, 0) - Math.min(1, first.remaining);
      mutate(
        (d) => setBatchRemaining(d, first.id, Math.max(0, first.remaining - 1)),
        () => api<{ before: Batch | null }>("/api/use", "POST", { productId: pid, area }),
      ).then((r) => {
        if (r?.before) {
          const before = r.before;
          toast(`${p.name}: nog ${Math.max(0, Math.round(rest * 100) / 100)} ${p.unit} in ${AREA_LABEL[area]}`, "Ongedaan", () => restore(before));
        }
      });
    },
    [byProduct, productMap, mutate, toast, restore],
  );

  const adjust = useCallback(
    (b: Batch, delta: number) => {
      const next = Math.max(0, Math.round((b.remaining + delta) * 100) / 100);
      mutate(
        (d) => setBatchRemaining(d, b.id, next),
        () => api(`/api/batches/${encodeURIComponent(b.id)}`, "PATCH", { delta }),
      );
    },
    [mutate],
  );

  const discard = useCallback(
    (b: Batch) => {
      const p = productMap.get(b.productId);
      mutate(
        (d) => setBatchRemaining(d, b.id, 0),
        () => api(`/api/batches/${encodeURIComponent(b.id)}?reden=weggegooid`, "DELETE"),
      ).then((r) => {
        if (r) toast(`${p?.name ?? "Product"} weggegooid`, "Ongedaan", () => restore(b));
      });
    },
    [productMap, mutate, toast, restore],
  );

  const setExpiry = useCallback(
    (b: Batch, expires: string | null) => {
      mutate(
        (d) => ({ ...d, batches: d.batches.map((x) => (x.id === b.id ? { ...x, expires } : x)) }),
        () => api(`/api/batches/${encodeURIComponent(b.id)}`, "PATCH", { expires }),
      ).then((r) => {
        if (r) toast("Vervaldatum aangepast");
      });
    },
    [mutate, toast],
  );

  const addBatch = useCallback(
    async (input: Omit<BatchInput, "createdBy">) => {
      const created = await mutate(null, () => api<Batch>("/api/batches", "POST", { ...input, createdBy: me || null }));
      if (created) setData((d) => ({ ...d, batches: [...d.batches.filter((x) => x.id !== created.id), created] }));
      return created;
    },
    [mutate, me],
  );

  const removeBatch = useCallback(
    (id: string) => {
      mutate(
        (d) => ({ ...d, batches: d.batches.filter((b) => b.id !== id) }),
        () => api(`/api/batches/${encodeURIComponent(id)}`, "DELETE"),
      );
    },
    [mutate],
  );

  const saveProduct = useCallback(
    async (id: string | null, input: ProductInput) => {
      const saved = await mutate(null, () =>
        id ? api<Product>(`/api/products/${encodeURIComponent(id)}`, "PATCH", input) : api<Product>("/api/products", "POST", input),
      );
      if (saved) setData((d) => ({ ...d, products: [...d.products.filter((p) => p.id !== saved.id), saved] }));
      return saved;
    },
    [mutate],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      const p = productMap.get(id);
      const r = await mutate(
        (d) => ({ ...d, products: d.products.filter((x) => x.id !== id), batches: d.batches.filter((b) => b.productId !== id) }),
        () => api(`/api/products/${encodeURIComponent(id)}`, "DELETE"),
      );
      if (r) toast(`${p?.name ?? "Product"} verwijderd`);
    },
    [productMap, mutate, toast],
  );

  const saveSupplier = useCallback(
    async (id: string | null, input: SupplierInput) => {
      const saved = await mutate(null, () =>
        id ? api<Supplier>(`/api/suppliers/${encodeURIComponent(id)}`, "PATCH", input) : api<Supplier>("/api/suppliers", "POST", input),
      );
      if (saved) setData((d) => ({ ...d, suppliers: [...d.suppliers.filter((s) => s.id !== saved.id), saved] }));
      return saved;
    },
    [mutate],
  );

  const deleteSupplier = useCallback(
    async (id: string) => {
      const s = supplierMap.get(id);
      const r = await mutate(
        (d) => ({
          ...d,
          suppliers: d.suppliers.filter((x) => x.id !== id),
          products: d.products.map((p) => (p.supplierId === id ? { ...p, supplierId: null } : p)),
        }),
        () => api(`/api/suppliers/${encodeURIComponent(id)}`, "DELETE"),
      );
      if (r) toast(`${s?.name ?? "Leverancier"} verwijderd`);
    },
    [supplierMap, mutate, toast],
  );

  const saveSettings = useCallback(
    async (s: Settings) => {
      const r = await mutate((d) => ({ ...d, settings: s }), () => api<Settings>("/api/settings", "PUT", s));
      return !!r;
    },
    [mutate],
  );

  /* ---------- navigatie ---------- */
  const goTab = useCallback((t: Tab, opts: TabOptions = {}) => {
    setTab(t);
    setTabOpts(opts);
    setTabKey((k) => k + 1);
    window.scrollTo(0, 0);
  }, []);
  const openProduct = useCallback((pid: string | null, area?: Area) => setSheet({ kind: "product", pid, area }), []);
  const openSupplier = useCallback((id: string | null) => setSheet({ kind: "supplier", id }), []);
  const openSettings = useCallback(() => setSheet({ kind: "settings" }), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const ctx: Ctx = {
    data,
    products,
    productMap,
    suppliers,
    supplierMap,
    infoOf,
    me,
    setMe,
    area,
    setArea,
    goTab,
    openProduct,
    openSupplier,
    openSettings,
    closeSheet,
    toast,
    consumeOne,
    adjust,
    restore,
    discard,
    setExpiry,
    addBatch,
    removeBatch,
    saveProduct,
    deleteProduct,
    saveSupplier,
    deleteSupplier,
    saveSettings,
  };

  /* ---------- tellers op de tabs ---------- */
  const today = todayISO();
  const attention = data.batches.filter(
    (b) => b.remaining > 0 && b.expires && productMap.has(b.productId) && daysBetween(today, b.expires) <= data.settings.warnDays,
  ).length;
  const toOrder = products.filter((p) => needsOrder(p, infoOf(p))).length;

  const tabs: { id: Tab; label: string; icon: IconName; count?: number }[] = [
    { id: "vandaag", label: "Vandaag", icon: "clock", count: attention },
    { id: "stock", label: "Stock", icon: "box" },
    { id: "inboeken", label: "Inboeken", icon: "plus" },
    { id: "bestellen", label: "Bestellen", icon: "list", count: toOrder },
    { id: "meer", label: "Meer", icon: "more" },
  ];

  return (
    <StockContext.Provider value={ctx}>
      <header className="top">
        <div className="bar">
          <img className="logo" src="/logo.svg" alt="" width={40} height={40} />
          <div className="brand">
            <b>Stocklijst</b>
            <span suppressHydrationWarning>
              Cantine · {new Date().toLocaleDateString("nl-BE", { weekday: "short", day: "numeric", month: "short" })}
              {me ? ` · ${me}` : ""}
            </span>
          </div>
          <nav className="tabs" aria-label="Onderdelen">
            {tabs.map((t) => (
              <button key={t.id} className="tab" aria-current={tab === t.id ? "page" : undefined} onClick={() => goTab(t.id)}>
                <Icon name={t.icon} />
                {t.label}
                {!!t.count && loaded && <span className="count">{t.count}</span>}
              </button>
            ))}
          </nav>
          <button className="icon-btn" aria-label="Instellingen" onClick={openSettings}>
            <Icon name="gear" />
          </button>
        </div>
      </header>

      <main className="wrap">
        {!loaded ? (
          loadError ? (
            <div className="stack">
              <div>
                <h1 className="h1">Stocklijst</h1>
                <p className="lead">De stock kon niet geladen worden.</p>
              </div>
              <div className="empty">
                {loadError}
              </div>
              <button className="btn" onClick={() => refresh()}>
                Opnieuw proberen
              </button>
            </div>
          ) : (
            <div className="loading">Stock laden…</div>
          )
        ) : tab === "vandaag" ? (
          <Today />
        ) : tab === "stock" ? (
          <StockList />
        ) : tab === "inboeken" ? (
          <Inboeken key={tabKey} initialPid={tabOpts.pid ?? null} />
        ) : tab === "bestellen" ? (
          <Bestellen key={tabKey} initialSupplier={tabOpts.supplierId ?? null} />
        ) : (
          <Meer key={tabKey} initialView={tabOpts.view ?? "menu"} />
        )}
      </main>

      {sheet?.kind === "product" && <ProductSheet key={sheet.pid ?? "nieuw"} pid={sheet.pid} newArea={sheet.area} />}
      {sheet?.kind === "supplier" && <SupplierSheet key={sheet.id ?? "nieuw"} id={sheet.id} />}
      {sheet?.kind === "settings" && <SettingsSheet />}
      {nameChecked && !me && <NamePrompt />}

      {toastState && (
        <div className="toast" role="status" key={toastState.id}>
          <span>{toastState.msg}</span>
          {toastState.actionLabel && (
            <button
              type="button"
              onClick={() => {
                setToast(null);
                toastState.action?.();
              }}
            >
              {toastState.actionLabel}
            </button>
          )}
        </div>
      )}
    </StockContext.Provider>
  );
}
