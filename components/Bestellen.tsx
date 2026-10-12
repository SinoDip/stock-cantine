"use client";

import { useRef, useState } from "react";
import { useStock } from "./StockApp";
import { SectionHead } from "./ui";
import { Icon } from "./Icons";
import { byCategory, fmtMoney, fmtNum, longDate, needsOrder, norm, suggestOrder } from "@/lib/stock";
import type { Product } from "@/lib/types";

const NONE = "__geen";

export default function Bestellen({ initialSupplier }: { initialSupplier: string | null }) {
  const { products, suppliers, supplierMap, infoOf, toast } = useStock();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [off, setOff] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState<Set<string>>(new Set());
  const [addValue, setAddValue] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<string>(initialSupplier && supplierMap.has(initialSupplier) ? initialSupplier : "");
  const previewRef = useRef<HTMLPreElement>(null);

  const ids = new Set([...products.filter((p) => needsOrder(p, infoOf(p))).map((p) => p.id), ...extra]);
  const allItems = products.filter((p) => ids.has(p.id));
  const matchSupplier = (p: Product) =>
    !supplierFilter || (supplierFilter === NONE ? !p.supplierId : p.supplierId === supplierFilter);
  const items = allItems.filter(matchSupplier);
  const qtyOf = (p: Product) => qty[p.id] ?? suggestOrder(p, infoOf(p).total);

  const groups = new Map<string, Product[]>();
  for (const p of items) {
    const c = p.category || "Overige";
    groups.set(c, [...(groups.get(c) ?? []), p]);
  }
  const order = [...groups.keys()].sort(byCategory);

  const chosen = items.filter((p) => !off.has(p.id) && qtyOf(p) > 0);
  const supplier = supplierFilter && supplierFilter !== NONE ? supplierMap.get(supplierFilter) : undefined;
  const priced = chosen.filter((p) => p.price != null);
  const total = priced.reduce((s, p) => s + (p.price ?? 0) * qtyOf(p), 0);

  let text = `Bestelling ${longDate()}${supplier ? ` – ${supplier.name}` : ""}`;
  if (supplier?.customerNumber) text += `\nKlantnummer: ${supplier.customerNumber}`;
  text += "\n";
  for (const c of order) {
    const ps = chosen.filter((p) => (p.category || "Overige") === c);
    if (!ps.length) continue;
    text += `\n${c}\n` + ps.map((p) => `- ${p.name}: ${fmtNum(qtyOf(p))} ${p.unit}`.trimEnd()).join("\n") + "\n";
  }
  text = text.trim();

  // Leveranciers die iets op de lijst hebben, voor de filterknoppen.
  const countFor = (id: string) => allItems.filter((p) => (id === NONE ? !p.supplierId : p.supplierId === id)).length;
  const supplierChips = suppliers.filter((s) => countFor(s.id) > 0);
  const noSupplierCount = countFor(NONE);

  function addProduct(value: string) {
    setAddValue(value);
    const p = products.find((x) => norm(x.name) === norm(value));
    if (!p) return;
    setExtra((s) => new Set(s).add(p.id));
    setOff((s) => {
      const n = new Set(s);
      n.delete(p.id);
      return n;
    });
    setQty((q) => ({ ...q, [p.id]: q[p.id] ?? Math.max(1, p.min ?? 1) }));
    setAddValue("");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast("Lijst gekopieerd");
    } catch {
      const el = previewRef.current;
      if (el) {
        const r = document.createRange();
        r.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(r);
      }
      toast("Tekst geselecteerd. Kopieer met Ctrl+C of lang drukken.");
    }
  }

  // Belgisch nummer (0475 …) omzetten naar internationaal formaat voor WhatsApp (32475…).
  const digits = supplier?.phone ? supplier.phone.replace(/[^\d]/g, "") : "";
  const waNumber = digits.startsWith("00") ? digits.slice(2) : digits.startsWith("0") ? `32${digits.slice(1)}` : digits;

  return (
    <div className="stack">
      <div>
        <h1 className="h1">Bestellijst</h1>
        <p className="lead">Alles wat op of onder het minimum zit. Pas de aantallen aan en stuur de lijst door.</p>
      </div>

      {(supplierChips.length > 0 || (supplierFilter && supplierFilter !== NONE)) && (
        <div className="chips" style={{ paddingTop: 0 }}>
          <button className="chip" aria-pressed={!supplierFilter} onClick={() => setSupplierFilter("")}>
            Alles ({allItems.length})
          </button>
          {supplierChips.map((s) => (
            <button key={s.id} className="chip" aria-pressed={supplierFilter === s.id} onClick={() => setSupplierFilter(s.id)}>
              {s.name} ({countFor(s.id)})
            </button>
          ))}
          {supplier && !supplierChips.some((s) => s.id === supplier.id) && (
            <button className="chip" aria-pressed onClick={() => setSupplierFilter(supplier.id)}>
              {supplier.name} (0)
            </button>
          )}
          {noSupplierCount > 0 && (
            <button className="chip" aria-pressed={supplierFilter === NONE} onClick={() => setSupplierFilter(NONE)}>
              Zonder leverancier ({noSupplierCount})
            </button>
          )}
        </div>
      )}

      {supplier && (
        <div className="summary-line" style={{ flexWrap: "wrap" }}>
          <span>
            {supplier.name}
            {supplier.orderDeadline ? ` · bestellen voor ${supplier.orderDeadline}` : ""}
          </span>
          {supplier.phone && (
            <a className="linkish" href={`tel:${supplier.phone.replace(/[^\d+]/g, "")}`} style={{ padding: 0 }}>
              {supplier.phone}
            </a>
          )}
        </div>
      )}

      {!items.length ? (
        <div className="empty">
          {supplier ? `Niets van ${supplier.name} onder het minimum.` : "Niets om te bestellen. Alles zit boven het minimum."}
        </div>
      ) : (
        <div>
          {order.map((c) => (
            <div key={c}>
              <div className="group-title">
                <h2 className="h3">{c}</h2>
              </div>
              <div className="list">
                {groups.get(c)!.map((p) => {
                  const i = infoOf(p);
                  const on = !off.has(p.id);
                  const sup = p.supplierId ? supplierMap.get(p.supplierId) : undefined;
                  return (
                    <div className="row order-row" key={p.id}>
                      <label className="check" style={{ flex: 1, minWidth: 0 }}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) =>
                            setOff((s) => {
                              const n = new Set(s);
                              if (e.target.checked) n.delete(p.id);
                              else n.add(p.id);
                              return n;
                            })
                          }
                        />
                        <span className="row-main">
                          <span className="name" style={{ display: "block" }}>
                            {p.name}
                          </span>
                          <span className="meta">
                            nog {fmtNum(i.total)} · min. {p.min != null ? fmtNum(p.min) : "–"}
                            {p.price != null && <span className="money">{fmtMoney(p.price * qtyOf(p))}</span>}
                            {sup && !supplier && <span>{sup.name}</span>}
                          </span>
                        </span>
                      </label>
                      <div className="row-side" style={{ flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <div className="stepper">
                          <button type="button" aria-label="Minder" onClick={() => setQty((q) => ({ ...q, [p.id]: Math.max(0, qtyOf(p) - 1) }))}>
                            −
                          </button>
                          <output className="num">{fmtNum(qtyOf(p))}</output>
                          <button type="button" aria-label="Meer" onClick={() => setQty((q) => ({ ...q, [p.id]: qtyOf(p) + 1 }))}>
                            +
                          </button>
                        </div>
                        <span className="h3" style={{ fontSize: 11 }}>
                          {p.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <label className="field">
        <span>Iets anders toevoegen</span>
        <input
          className="input"
          id="ord-add"
          list="ord-dl"
          placeholder="Kies een product"
          autoComplete="off"
          value={addValue}
          onChange={(e) => addProduct(e.target.value)}
        />
        <datalist id="ord-dl">
          {products
            .filter((p) => !ids.has(p.id))
            .map((p) => (
              <option key={p.id} value={p.name} />
            ))}
        </datalist>
      </label>

      {chosen.length > 0 && (
        <section>
          {priced.length > 0 && (
            <div className="summary-line" style={{ marginBottom: 12 }}>
              <span>
                Geschat bedrag
                {priced.length < chosen.length ? ` (${priced.length} van ${chosen.length} met prijs)` : ""}
              </span>
              <span className="money">{fmtMoney(total)}</span>
            </div>
          )}
          <SectionHead title="Bericht" count={chosen.length} />
          <pre className="preview" ref={previewRef}>
            {text}
          </pre>
          <div className="actions" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={copy}>
              Kopieer lijst
            </button>
            <a
              className="btn"
              href={`https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {supplier && waNumber ? `WhatsApp naar ${supplier.name}` : "Deel via WhatsApp"}
            </a>
            {supplier?.email && (
              <a
                className="btn"
                href={`mailto:${supplier.email}?subject=${encodeURIComponent(`Bestelling ${longDate()}`)}&body=${encodeURIComponent(text)}`}
              >
                <Icon name="mail" /> Mail
              </a>
            )}
          </div>
        </section>
      )}
      {items.length > 0 && !chosen.length && <div className="empty">Vink minstens één product aan.</div>}
    </div>
  );
}
