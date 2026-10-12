"use client";

import { useState, type FormEvent } from "react";
import { useStock } from "./StockApp";
import { ConfirmButton, Qty, Row, SectionHead, Sheet } from "./ui";
import { Icon } from "./Icons";
import { WEEKDAYS, fmtDays, needsOrder, norm } from "@/lib/stock";
import type { Supplier, SupplierInput } from "@/lib/types";

type Form = {
  name: string;
  contact: string;
  phone: string;
  email: string;
  customerNumber: string;
  orderDays: number[];
  orderDeadline: string;
  deliveryDays: number[];
  notes: string;
};

function formFrom(s?: Supplier): Form {
  return {
    name: s?.name ?? "",
    contact: s?.contact ?? "",
    phone: s?.phone ?? "",
    email: s?.email ?? "",
    customerNumber: s?.customerNumber ?? "",
    orderDays: s?.orderDays ?? [],
    orderDeadline: s?.orderDeadline ?? "",
    deliveryDays: s?.deliveryDays ?? [],
    notes: s?.notes ?? "",
  };
}

function toInput(f: Form): SupplierInput {
  const t = (v: string) => v.trim() || null;
  return {
    name: f.name.trim(),
    contact: t(f.contact),
    phone: t(f.phone),
    email: t(f.email),
    customerNumber: t(f.customerNumber),
    orderDays: f.orderDays,
    orderDeadline: t(f.orderDeadline),
    deliveryDays: f.deliveryDays,
    notes: t(f.notes),
  };
}

function DayPicker({ value, onChange, label }: { value: number[]; onChange: (v: number[]) => void; label: string }) {
  return (
    <div className="daypick" role="group" aria-label={label}>
      {WEEKDAYS.map((d, i) => {
        const day = i + 1;
        const on = value.includes(day);
        return (
          <button
            type="button"
            key={d}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== day) : [...value, day].sort((a, b) => a - b))}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

export default function SupplierSheet({ id }: { id: string | null }) {
  const { supplierMap, suppliers, products, infoOf, closeSheet, saveSupplier, deleteSupplier, toast, openProduct, goTab } = useStock();
  const s = id ? supplierMap.get(id) : undefined;
  const [form, setForm] = useState<Form>(formFrom(s));
  const [editOpen, setEditOpen] = useState(!s);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  if (id && !s) {
    return (
      <Sheet title="Leverancier niet gevonden" onClose={closeSheet}>
        <div className="empty">Deze leverancier bestaat niet meer.</div>
      </Sheet>
    );
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const nm = form.name.trim();
    if (!nm) return toast("Geef de leverancier een naam.");
    const dup = suppliers.find((x) => norm(x.name) === norm(nm) && x.id !== id);
    if (dup) return toast(`“${dup.name}” bestaat al.`);
    if (form.orderDeadline && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(form.orderDeadline.trim()))
      return toast("Schrijf de deadline als uu:mm, bv. 14:00.");
    setBusy(true);
    const saved = await saveSupplier(id, toInput(form));
    setBusy(false);
    if (!saved) return;
    if (id) {
      toast("Opgeslagen");
      setEditOpen(false);
    } else {
      toast(`${saved.name} toegevoegd`);
      closeSheet();
    }
  }

  const fields = (
    <form className="form" onSubmit={save} noValidate style={s ? undefined : { borderRadius: 14 }}>
      <label className="field">
        <span>Naam</span>
        <input className="input" id="sf-name" value={form.name} autoComplete="organization" onChange={(e) => set("name", e.target.value)} autoFocus={!s} />
      </label>
      <div className="grid2 wrap1">
        <label className="field">
          <span>Contactpersoon</span>
          <input className="input" id="sf-contact" value={form.contact} autoComplete="off" onChange={(e) => set("contact", e.target.value)} />
        </label>
        <label className="field">
          <span>Klantnummer</span>
          <input className="input" id="sf-klant" value={form.customerNumber} autoComplete="off" onChange={(e) => set("customerNumber", e.target.value)} />
        </label>
      </div>
      <div className="grid2 wrap1">
        <label className="field">
          <span>Telefoon</span>
          <input className="input" id="sf-phone" type="tel" value={form.phone} autoComplete="off" onChange={(e) => set("phone", e.target.value)} />
        </label>
        <label className="field">
          <span>E-mail</span>
          <input className="input" id="sf-email" type="email" value={form.email} autoComplete="off" onChange={(e) => set("email", e.target.value)} />
        </label>
      </div>
      <div className="field">
        <span>Besteldagen</span>
        <DayPicker value={form.orderDays} onChange={(v) => set("orderDays", v)} label="Besteldagen" />
      </div>
      <label className="field">
        <span>Bestellen voor</span>
        <input
          className="input num"
          id="sf-deadline"
          type="time"
          style={{ maxWidth: 160 }}
          value={form.orderDeadline}
          onChange={(e) => set("orderDeadline", e.target.value)}
        />
        <small>Op een besteldag zie je op het scherm Vandaag hoeveel tijd je nog hebt.</small>
      </label>
      <div className="field">
        <span>Leverdagen</span>
        <DayPicker value={form.deliveryDays} onChange={(v) => set("deliveryDays", v)} label="Leverdagen" />
      </div>
      <label className="field">
        <span>Notities</span>
        <textarea
          className="input"
          id="sf-notes"
          value={form.notes}
          placeholder="Bv. minimum bestelbedrag, bestellen via webshop, levering aan achterdeur…"
          onChange={(e) => set("notes", e.target.value)}
        />
      </label>
      <div className="actions">
        <button className="btn primary" type="submit" disabled={busy}>
          {s ? "Opslaan" : "Leverancier toevoegen"}
        </button>
        {s && (
          <ConfirmButton
            label="Leverancier verwijderen"
            confirmLabel="Zeker? Tik nog eens"
            onConfirm={() => {
              closeSheet();
              deleteSupplier(s.id);
            }}
          />
        )}
      </div>
    </form>
  );

  if (!s) {
    return (
      <Sheet title="Nieuwe leverancier" onClose={closeSheet}>
        {fields}
      </Sheet>
    );
  }

  const linked = products.filter((p) => p.supplierId === s.id);
  const low = linked.filter((p) => needsOrder(p, infoOf(p)));
  const sub = [
    s.contact,
    s.customerNumber ? `klantnr. ${s.customerNumber}` : null,
    s.orderDays.length ? `bestellen ${fmtDays(s.orderDays)}${s.orderDeadline ? ` voor ${s.orderDeadline}` : ""}` : null,
    s.deliveryDays.length ? `levering ${fmtDays(s.deliveryDays)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Sheet title={s.name} sub={sub || undefined} onClose={closeSheet}>
      {(s.phone || s.email) && (
        <div className="contact">
          {s.phone && (
            <a className="btn" href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}>
              <Icon name="phone" /> {s.phone}
            </a>
          )}
          {s.email && (
            <a className="btn" href={`mailto:${s.email}`}>
              <Icon name="mail" /> {s.email}
            </a>
          )}
        </div>
      )}
      {s.notes && <div className="empty" style={{ whiteSpace: "pre-wrap", borderStyle: "solid" }}>{s.notes}</div>}

      {low.length > 0 && (
        <button
          className="btn primary block"
          onClick={() => {
            closeSheet();
            goTab("bestellen", { supplierId: s.id });
          }}
        >
          Bestellijst voor {s.name} ({low.length})
        </button>
      )}

      <section>
        <SectionHead title="Producten" count={linked.length} />
        {linked.length ? (
          <div className="list">
            {linked.map((p) => {
              const i = infoOf(p);
              return (
                <Row key={p.id} onOpen={() => openProduct(p.id)}>
                  <div className="row-main">
                    <div className="name">{p.name}</div>
                    {i.low !== "ok" && p.min != null && (
                      <div className="meta">{i.low === "op" ? <span className="pill bad">Op</span> : <span className="pill low">Op minimum</span>}</div>
                    )}
                  </div>
                  <div className="row-side">
                    <Qty n={i.total} unit={p.unit} />
                  </div>
                </Row>
              );
            })}
          </div>
        ) : (
          <div className="empty">Nog geen producten gekoppeld. Kies deze leverancier bij een product onder “Product aanpassen”.</div>
        )}
      </section>

      <details className="edit" open={editOpen} onToggle={(e) => setEditOpen((e.target as HTMLDetailsElement).open)}>
        <summary>Leverancier aanpassen</summary>
        {fields}
      </details>
    </Sheet>
  );
}
