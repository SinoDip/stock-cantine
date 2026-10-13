"use client";

import { useState, type FormEvent } from "react";
import { useStock } from "./StockApp";
import ProductFields, { emptyForm, formFrom, toInput, type ProductForm } from "./ProductFields";
import { ConfirmButton, ExpTag, SectionHead, Sheet } from "./ui";
import { AREAS, AREA_LABEL, fmtDate, fmtMoney, fmtNum, norm } from "@/lib/stock";
import type { Area } from "@/lib/types";

export default function ProductSheet({ pid, newArea }: { pid: string | null; newArea?: Area }) {
  const { productMap, products, suppliers, supplierMap, infoOf, data, closeSheet, adjust, setExpiry, saveProduct, deleteProduct, goTab, toast, openSupplier } =
    useStock();
  const p = pid ? productMap.get(pid) : undefined;

  const [name, setName] = useState(p?.name ?? "");
  const [form, setForm] = useState<ProductForm>(p ? formFrom(p) : emptyForm(newArea));
  const [editOpen, setEditOpen] = useState(!p);
  const [busy, setBusy] = useState(false);

  // Product intussen verwijderd door iemand anders.
  if (pid && !p) {
    return (
      <Sheet title="Product niet gevonden" onClose={closeSheet}>
        <div className="empty">Dit product bestaat niet meer.</div>
      </Sheet>
    );
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const nm = name.trim();
    if (!nm) return toast("Geef het product een naam.");
    const dup = products.find((x) => norm(x.name) === norm(nm) && x.id !== pid);
    if (dup) return toast(`“${dup.name}” bestaat al.`);
    if (!form.areas.length) return toast("Kies Keuken, Front of allebei.");
    if (p) {
      const dropped = AREAS.find((a) => !form.areas.includes(a) && infoOf(p, a).total > 0);
      if (dropped)
        return toast(`Er staat nog ${fmtNum(infoOf(p, dropped).total)} ${p.unit} in ${AREA_LABEL[dropped]}. Haal die eerst weg.`);
    }
    setBusy(true);
    const saved = await saveProduct(pid, toInput(nm, form));
    setBusy(false);
    if (!saved) return;
    if (pid) {
      toast("Opgeslagen");
      setEditOpen(false);
    } else {
      toast(`${saved.name} toegevoegd`);
      closeSheet();
    }
  }

  const fields = (
    <form className="form" onSubmit={save} noValidate style={p ? undefined : { borderRadius: 14 }}>
      <label className="field">
        <span>Naam</span>
        <input className="input" id="pf-name" value={name} autoComplete="off" onChange={(e) => setName(e.target.value)} autoFocus={!p} />
      </label>
      <ProductFields value={form} onChange={setForm} idPrefix="pf" suppliers={suppliers} extraCategories={products.map((x) => x.category)} />
      <div className="actions">
        <button className="btn primary" type="submit" disabled={busy}>
          {p ? "Opslaan" : "Product toevoegen"}
        </button>
        {p && (
          <ConfirmButton
            label="Product verwijderen"
            confirmLabel="Zeker? Tik nog eens"
            onConfirm={() => {
              closeSheet();
              deleteProduct(p.id);
            }}
          />
        )}
      </div>
    </form>
  );

  if (!p) {
    return (
      <Sheet title="Nieuw product" onClose={closeSheet}>
        {fields}
      </Sheet>
    );
  }

  const i = infoOf(p);
  const split =
    p.areas.length > 1 ? ` (${p.areas.map((a) => `${fmtNum(infoOf(p, a).total)} ${AREA_LABEL[a].toLowerCase()}`).join(", ")})` : "";
  const sub =
    `${fmtNum(i.total)} ${p.unit} op stock${split}` +
    (p.min != null ? ` · minimum ${fmtNum(p.min)}` : " · geen minimum") +
    (p.prep && p.shelfDays ? ` · prep ${p.shelfDays} d houdbaar` : "") +
    (p.price != null ? ` · ${fmtMoney(p.price)} per ${p.unit}` : "");
  const supplier = p.supplierId ? supplierMap.get(p.supplierId) : undefined;

  return (
    <Sheet title={p.name} sub={sub} onClose={closeSheet}>
      {(supplier || p.allergens.length > 0) && (
        <div className="meta" style={{ marginTop: -8 }}>
          {supplier && (
            <button
              type="button"
              className="pill plain"
              style={{ border: 0, cursor: "pointer" }}
              onClick={() => openSupplier(supplier.id)}
            >
              Leverancier: {supplier.name}
            </button>
          )}
          {p.allergens.map((a) => (
            <span key={a} className="pill allergen">
              {a}
            </span>
          ))}
        </div>
      )}
      <section>
        <SectionHead title="Op stock, eerst gebruiken bovenaan" />
        <div className="list">
          {i.batches.length ? (
            i.batches.map((b) => (
              <div className="batch" key={b.id}>
                <div className="bmain">
                  <div className="meta" style={{ marginTop: 0 }}>
                    <span className="pill area">{AREA_LABEL[b.area]}</span>
                    {b.expires ? <ExpTag b={b} warnDays={data.settings.warnDays} /> : <span className="pill plain">Geen vervaldatum</span>}
                  </div>
                  <div className="bmeta">
                    {p.prep ? "Geprept" : "Binnen"} {fmtDate(b.received)}
                    {b.createdBy ? ` · door ${b.createdBy}` : ""}
                    {b.note ? ` · ${b.note}` : ""}
                  </div>
                </div>
                <label className="bmeta" style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
                  Vervalt
                  <input
                    key={`${b.id}-${b.expires ?? ""}`}
                    type="date"
                    aria-label="Vervaldatum"
                    defaultValue={b.expires ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value || null;
                      if (v !== b.expires) setExpiry(b, v);
                    }}
                  />
                </label>
                <div className="stepper">
                  <button type="button" aria-label="Eén minder" onClick={() => adjust(b, -1)}>
                    −
                  </button>
                  <output className="num">{fmtNum(b.remaining)}</output>
                  <button type="button" aria-label="Eén meer" onClick={() => adjust(b, 1)}>
                    +
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty" style={{ border: 0 }}>
              Niets op stock.
            </div>
          )}
        </div>
      </section>

      <button
        className="btn primary block"
        onClick={() => {
          closeSheet();
          goTab("inboeken", { pid: p.id });
        }}
      >
        Levering inboeken
      </button>

      <details className="edit" open={editOpen} onToggle={(e) => setEditOpen((e.target as HTMLDetailsElement).open)}>
        <summary>Product aanpassen</summary>
        {fields}
      </details>
    </Sheet>
  );
}
