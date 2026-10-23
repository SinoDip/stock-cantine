"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./StockApp";
import { fmtNum, localISO, todayISO } from "@/lib/stock";
import type { LogAction, LogEntry } from "@/lib/types";

const LABELS: Record<LogAction, string> = {
  use: "gebruikte",
  adjust: "paste aantal aan van",
  expiry: "wijzigde vervaldatum van",
  add: "boekte in:",
  restore: "maakte ongedaan:",
  discard: "gooide weg:",
  remove: "verwijderde levering van",
  product_add: "voegde product toe:",
  product_edit: "paste product aan:",
  product_delete: "verwijderde product:",
  supplier_add: "voegde leverancier toe:",
  supplier_edit: "paste leverancier aan:",
  supplier_delete: "verwijderde leverancier:",
  settings: "wijzigde instellingen:",
  order: "bestelde bij",
  order_receive: "boekte bestelling in van",
  order_cancel: "annuleerde bestelling bij",
  count: "telde",
};

const FILTERS: { id: string; label: string; actions: LogAction[] | null }[] = [
  { id: "alles", label: "Alles", actions: null },
  { id: "gebruik", label: "Gebruikt", actions: ["use"] },
  { id: "in", label: "Ingeboekt", actions: ["add"] },
  { id: "weg", label: "Weggegooid", actions: ["discard"] },
  { id: "best", label: "Bestellingen", actions: ["order", "order_receive", "order_cancel"] },
  { id: "tel", label: "Telling", actions: ["count"] },
  {
    id: "wijz",
    label: "Wijzigingen",
    actions: ["adjust", "expiry", "restore", "remove", "product_add", "product_edit", "product_delete", "supplier_add", "supplier_edit", "supplier_delete", "settings"],
  },
];

function dayLabel(iso: string): string {
  const t = todayISO();
  if (iso === t) return "Vandaag";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (iso === localISO(y)) return "Gisteren";
  const [yy, m, d] = iso.split("-").map(Number);
  return new Date(yy, m - 1, d).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
}

function qtyText(e: LogEntry): string {
  if (e.qty == null) return "";
  if (e.action === "use" || e.action === "adjust") return ` (${e.qty > 0 ? "+" : ""}${fmtNum(e.qty)})`;
  return ` (${fmtNum(e.qty)})`;
}

export default function Logboek() {
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("alles");
  const [who, setWho] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api<{ entries: LogEntry[] }>("/api/log");
      setEntries(r.entries);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const people = [...new Set((entries ?? []).map((e) => e.who).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "nl"));
  const f = FILTERS.find((x) => x.id === filter)!;
  const shown = (entries ?? []).filter((e) => (!f.actions || f.actions.includes(e.action)) && (!who || e.who === who));

  const groups = new Map<string, LogEntry[]>();
  for (const e of shown) {
    const day = localISO(new Date(e.createdAt));
    groups.set(day, [...(groups.get(day) ?? []), e]);
  }

  return (
    <div className="stack">
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="h1">Logboek</h1>
          <p className="lead">De laatste 400 acties van het team.</p>
        </div>
        <button className="btn small" onClick={load}>
          Vernieuwen
        </button>
      </div>

      <div>
        <div className="chips" style={{ paddingTop: 0 }}>
          {FILTERS.map((x) => (
            <button key={x.id} className="chip" aria-pressed={filter === x.id} onClick={() => setFilter(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        {people.length > 1 && (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8, fontWeight: 600 }}>
            Persoon
            <select className="select-inline" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">Iedereen</option>
              {people.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error ? (
        <div className="empty">
          Het logboek kon niet geladen worden. {error} Heb je <b>update-1.sql</b> al uitgevoerd in Supabase?
        </div>
      ) : !entries ? (
        <div className="loading">Logboek laden…</div>
      ) : !shown.length ? (
        <div className="empty">Nog niets in het logboek{filter !== "alles" || who ? " voor deze keuze" : ""}.</div>
      ) : (
        [...groups.entries()].map(([day, list]) => (
          <section key={day}>
            <div className="group-title" style={{ marginTop: 0 }}>
              <h2 className="h3">{dayLabel(day)}</h2>
              <span className="h3">{list.length}</span>
            </div>
            <div className="list">
              {list.map((e) => (
                <div className="log-row" key={e.id}>
                  <div className="log-time">
                    {new Date(e.createdAt).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="log-main">
                    <b>{e.who || "Onbekend"}</b> {LABELS[e.action] ?? e.action}{" "}
                    {e.productName ? <b>{e.productName}</b> : e.detail ? <b>{e.detail}</b> : null}
                    {qtyText(e)}
                    {e.productName && e.detail && <div className="log-who">{e.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
