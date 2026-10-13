"use client";

import { ALLERGENS, AREAS, AREA_LABEL, CATEGORIES, LOCATIONS } from "@/lib/stock";
import type { Area, Product, ProductInput, Supplier } from "@/lib/types";

/** Formulierwaarden als tekst, zodat lege velden leeg kunnen blijven. */
export type ProductForm = {
  category: string;
  unit: string;
  min: string;
  location: string;
  prep: boolean;
  shelfDays: string;
  supplierId: string;
  price: string;
  allergens: string[];
  areas: Area[];
};

export function emptyForm(area: Area = "keuken"): ProductForm {
  return {
    category: "Overige",
    unit: "stuks",
    min: "",
    location: "",
    prep: false,
    shelfDays: "",
    supplierId: "",
    price: "",
    allergens: [],
    areas: [area],
  };
}

export function formFrom(p: Product): ProductForm {
  return {
    category: p.category || "Overige",
    unit: p.unit || "stuks",
    min: p.min == null ? "" : String(p.min),
    location: p.location ?? "",
    prep: p.prep,
    shelfDays: p.shelfDays ? String(p.shelfDays) : "",
    supplierId: p.supplierId ?? "",
    price: p.price == null ? "" : String(p.price),
    allergens: p.allergens ?? [],
    areas: p.areas,
  };
}

function num(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (t === "" || !Number.isFinite(Number(t))) return null;
  return Math.max(0, Number(t));
}

export function toInput(name: string, f: ProductForm): ProductInput {
  const days = Number(f.shelfDays);
  return {
    name: name.trim(),
    category: f.category,
    unit: f.unit.trim() || "stuks",
    min: num(f.min),
    location: f.location || null,
    prep: f.prep,
    shelfDays: f.prep && days > 0 ? Math.round(days) : null,
    supplierId: f.supplierId || null,
    price: num(f.price),
    allergens: f.allergens,
    areas: f.areas,
  };
}

export default function ProductFields({
  value,
  onChange,
  idPrefix,
  suppliers,
  extraCategories = [],
}: {
  value: ProductForm;
  onChange: (f: ProductForm) => void;
  idPrefix: string;
  suppliers: Supplier[];
  extraCategories?: string[];
}) {
  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => onChange({ ...value, [k]: v });
  const cats = [...new Set([...CATEGORIES, ...extraCategories, value.category].filter(Boolean))];
  const toggleAllergen = (a: string, on: boolean) =>
    set("allergens", on ? [...new Set([...value.allergens, a])] : value.allergens.filter((x) => x !== a));
  const toggleArea = (a: Area, on: boolean) =>
    set("areas", AREAS.filter((x) => (x === a ? on : value.areas.includes(x))));

  return (
    <>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 14, fontWeight: 650, marginBottom: 6 }}>Gebruikt in</legend>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {AREAS.map((a) => (
            <label className="check" key={a}>
              <input
                type="checkbox"
                id={`${idPrefix}-area-${a}`}
                checked={value.areas.includes(a)}
                onChange={(e) => toggleArea(a, e.target.checked)}
              />
              {AREA_LABEL[a]}
            </label>
          ))}
        </div>
        <small>Het product staat alleen op de stocklijst van de kant(en) die je aanvinkt.</small>
      </fieldset>
      <div className="grid2 wrap1">
        <label className="field">
          <span>Categorie</span>
          <select className="input" id={`${idPrefix}-cat`} value={value.category} onChange={(e) => set("category", e.target.value)}>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Eenheid</span>
          <input
            className="input"
            id={`${idPrefix}-unit`}
            value={value.unit}
            placeholder="stuks, zakken, kg…"
            autoComplete="off"
            onChange={(e) => set("unit", e.target.value)}
          />
        </label>
      </div>
      <div className="grid2 wrap1">
        <label className="field">
          <span>Minimumstock</span>
          <input
            className="input num"
            id={`${idPrefix}-min`}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="bv. 2"
            value={value.min}
            onChange={(e) => set("min", e.target.value)}
          />
          <small>Op of onder dit aantal komt het op de bestellijst.</small>
        </label>
        <label className="field">
          <span>Locatie</span>
          <select className="input" id={`${idPrefix}-loc`} value={value.location} onChange={(e) => set("location", e.target.value)}>
            <option value="">Geen</option>
            {LOCATIONS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid2 wrap1">
        <label className="field">
          <span>Leverancier</span>
          <select className="input" id={`${idPrefix}-sup`} value={value.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
            <option value="">Geen</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {!suppliers.length && <small>Voeg leveranciers toe via Meer → Leveranciers.</small>}
        </label>
        <label className="field">
          <span>Aankoopprijs per eenheid</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden="true">€</span>
            <input
              className="input num"
              id={`${idPrefix}-price`}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="bv. 4,50"
              value={value.price}
              onChange={(e) => set("price", e.target.value)}
            />
          </div>
          <small>Prijs voor 1 {value.unit.trim() || "stuk"}, zoals je het inboekt.</small>
        </label>
      </div>
      <label className="check">
        <input type="checkbox" id={`${idPrefix}-prep`} checked={value.prep} onChange={(e) => set("prep", e.target.checked)} />
        Zelfgemaakt (prep)
      </label>
      {value.prep && (
        <label className="field">
          <span>Houdbaar na prep</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              className="input num"
              id={`${idPrefix}-days`}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              style={{ maxWidth: 120 }}
              placeholder="bv. 3"
              value={value.shelfDays}
              onChange={(e) => set("shelfDays", e.target.value)}
            />
            <span>dagen</span>
          </div>
          <small>De vervaldatum wordt dan vanzelf ingevuld bij het inboeken.</small>
        </label>
      )}
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 14, fontWeight: 650, marginBottom: 6 }}>
          Allergenen {value.allergens.length ? `(${value.allergens.length})` : ""}
        </legend>
        <div className="allergen-grid">
          {ALLERGENS.map((a) => (
            <label className="check" key={a}>
              <input type="checkbox" checked={value.allergens.includes(a)} onChange={(e) => toggleAllergen(a, e.target.checked)} />
              {a}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
