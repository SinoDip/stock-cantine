"use client";

import { useState, type FormEvent } from "react";
import { useStock } from "./StockApp";
import { ConfirmButton } from "./ui";
import { Icon } from "./Icons";
import { AREAS, AREA_LABEL, addDays, fmtDate, fmtNum, todayISO } from "@/lib/stock";
import type { Area, Order } from "@/lib/types";

type Line = { on: boolean; qty: string; area: Area; expires: string };

/** Een bestelling inboeken die binnengekomen is: per product aantal, kant en vervaldatum nakijken. */
export default function Ontvangen({ order, onDone }: { order: Order; onDone: () => void }) {
  const { productMap, supplierMap, area: lastArea, receiveOrder, cancelOrder, toast } = useStock();
  const supplier = order.supplierId ? supplierMap.get(order.supplierId) : undefined;
  const lines = order.lines.filter((l) => productMap.has(l.productId));
  const [received, setReceived] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, Line>>(() =>
    Object.fromEntries(
      lines.map((l) => {
        const p = productMap.get(l.productId)!;
        return [
          l.productId,
          {
            on: true,
            qty: String(l.qty),
            area: p.areas.includes(lastArea) ? lastArea : p.areas[0],
            expires: p.prep && p.shelfDays ? addDays(todayISO(), p.shelfDays) : "",
          },
        ];
      }),
    ),
  );
  const set = (pid: string, patch: Partial<Line>) => setForm((f) => ({ ...f, [pid]: { ...f[pid], ...patch } }));
  const chosen = lines.filter((l) => form[l.productId].on);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!chosen.length) return toast("Vink minstens één product aan, of annuleer de bestelling.");
    const out = [];
    for (const l of chosen) {
      const f = form[l.productId];
      const n = Number(f.qty.replace(",", "."));
      if (!(n > 0)) return toast(`Vul bij ${productMap.get(l.productId)!.name} een aantal groter dan 0 in.`);
      out.push({ productId: l.productId, qty: n, area: f.area, expires: f.expires || null });
    }
    setBusy(true);
    const ok = await receiveOrder(order.id, received || todayISO(), out);
    setBusy(false);
    if (!ok) return;
    toast(`Ingeboekt: ${out.length} ${out.length === 1 ? "product" : "producten"}${supplier ? ` van ${supplier.name}` : ""}`);
    onDone();
  }

  return (
    <div className="stack">
      <div>
        <button className="back" onClick={onDone} type="button">
          <Icon name="back" />
          Inboeken
        </button>
        <h1 className="h1">{supplier ? `Levering ${supplier.name}` : "Levering ontvangen"}</h1>
        <p className="lead">
          Besteld op {fmtDate(order.createdAt.slice(0, 10))}
          {order.createdBy ? ` door ${order.createdBy}` : ""}. Kijk de aantallen en vervaldata na. Niet geleverd? Vink het af: het komt dan terug op de bestellijst.
        </p>
      </div>

      <form className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span>Geleverd op</span>
          <input className="input" id="ov-recv" type="date" style={{ maxWidth: 220 }} value={received} onChange={(e) => setReceived(e.target.value)} />
        </label>

        <div className="list">
          {lines.map((l) => {
            const p = productMap.get(l.productId)!;
            const f = form[l.productId];
            return (
              <div className="batch" key={l.productId} style={{ opacity: f.on ? 1 : 0.55 }}>
                <label className="check" style={{ flex: "1 1 180px", minWidth: 0 }}>
                  <input type="checkbox" checked={f.on} onChange={(e) => set(l.productId, { on: e.target.checked })} />
                  <span className="row-main">
                    <span className="name" style={{ display: "block" }}>
                      {p.name}
                    </span>
                    <span className="meta">
                      besteld {fmtNum(l.qty)} {p.unit}
                    </span>
                  </span>
                </label>
                {f.on && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <input
                      className="input num"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      aria-label={`Aantal ${p.name}`}
                      style={{ width: 90 }}
                      value={f.qty}
                      onChange={(e) => set(l.productId, { qty: e.target.value })}
                    />
                    {p.areas.length > 1 && (
                      <select
                        className="select-inline"
                        aria-label={`Kant voor ${p.name}`}
                        value={f.area}
                        onChange={(e) => set(l.productId, { area: e.target.value as Area })}
                      >
                        {AREAS.map((a) => (
                          <option key={a} value={a}>
                            {AREA_LABEL[a]}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      className="input"
                      type="date"
                      aria-label={`Houdbaar tot, ${p.name}`}
                      title="Houdbaar tot"
                      style={{ width: 170 }}
                      value={f.expires}
                      onChange={(e) => set(l.productId, { expires: e.target.value })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button className="btn primary block" type="submit" disabled={busy || !chosen.length}>
          {busy ? "Bezig…" : `Inboeken (${chosen.length})`}
        </button>
        <ConfirmButton
          label="Bestelling annuleren"
          confirmLabel="Zeker? Tik nog eens"
          onConfirm={async () => {
            if (await cancelOrder(order.id)) {
              toast("Bestelling geannuleerd");
              onDone();
            }
          }}
        />
      </form>
    </div>
  );
}
