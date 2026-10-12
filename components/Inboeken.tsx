"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useStock } from "./StockApp";
import ProductFields, { emptyForm, toInput, type ProductForm } from "./ProductFields";
import { ExpTag, Qty, Row, SectionHead } from "./ui";
import { addDays, fmtDate, fmtNum, localISO, norm, todayISO } from "@/lib/stock";

const QUICK_DAYS = [1, 2, 3, 5, 7, 14];

export default function Inboeken({ initialPid }: { initialPid: string | null }) {
  const { products, productMap, suppliers, data, addBatch, saveProduct, removeBatch, toast, openProduct } = useStock();

  const [pid, setPid] = useState<string | null>(initialPid && productMap.has(initialPid) ? initialPid : null);
  const [query, setQuery] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [newForm, setNewForm] = useState<ProductForm>(emptyForm());
  const [qty, setQty] = useState("1");
  const [received, setReceived] = useState(todayISO());
  const [expires, setExpires] = useState(() => {
    const p = initialPid ? productMap.get(initialPid) : undefined;
    return p?.prep && p.shelfDays ? addDays(todayISO(), p.shelfDays) : "";
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);

  const product = pid ? productMap.get(pid) : undefined;
  const isPrep = product ? product.prep : isNew && newForm.prep;
  const shelfDays = product ? product.shelfDays : isNew && newForm.prep ? Number(newForm.shelfDays) || null : null;

  const hits = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return [];
    return products.filter((p) => norm(p.name).includes(q)).slice(0, 6);
  }, [query, products]);
  const exact = products.some((p) => norm(p.name) === norm(query.trim()));

  function pick(id: string) {
    const p = productMap.get(id);
    setPid(id);
    setIsNew(false);
    setQuery("");
    setExpires(p?.prep && p.shelfDays ? addDays(received || todayISO(), p.shelfDays) : "");
  }

  function clearPick() {
    setPid(null);
    setIsNew(false);
    setQuery("");
    setExpires("");
  }

  function changeReceived(v: string) {
    setReceived(v);
    if (isPrep && shelfDays) setExpires(addDays(v || todayISO(), shelfDays));
  }

  function changeNewForm(f: ProductForm) {
    setNewForm(f);
    const days = Number(f.shelfDays);
    if (f.prep && days > 0) setExpires(addDays(received || todayISO(), days));
  }

  function step(d: number) {
    const v = Number(qty.replace(",", ".")) || 0;
    setQty(String(Math.max(0, Math.round((v + d) * 100) / 100)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(qty.replace(",", "."));
    if (!pid && !isNew) return toast("Kies eerst een product.");
    if (!(n > 0)) return toast("Vul een aantal groter dan 0 in.");
    setBusy(true);
    try {
      let id = pid;
      let unit = product?.unit ?? "";
      let name = product?.name ?? "";
      if (!id) {
        const nm = query.trim();
        if (!nm) return toast("Geef het nieuwe product een naam.");
        const created = await saveProduct(null, toInput(nm, newForm));
        if (!created) return;
        id = created.id;
        unit = created.unit;
        name = created.name;
      }
      const b = await addBatch({ productId: id, qty: n, received: received || todayISO(), expires: expires || null, note: note.trim() || null });
      if (!b) return;
      toast(`Ingeboekt: ${fmtNum(n)} ${unit} ${name}`, "Ongedaan", () => removeBatch(b.id));
      setQty("1");
      setNote("");
      setNewForm(emptyForm());
      clearPick();
    } finally {
      setBusy(false);
    }
  }

  const today = todayISO();
  const recent = data.batches
    .filter((b) => b.createdBy && localISO(new Date(b.createdAt)) === today && productMap.has(b.productId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const expHelp =
    isPrep && shelfDays
      ? `Prep blijft ${shelfDays} ${shelfDays === 1 ? "dag" : "dagen"} goed.`
      : expires
        ? `Houdbaar tot ${fmtDate(expires)}.`
        : isPrep
          ? "Stel de houdbaarheid in bij het product, of kies hieronder."
          : "Laat leeg als er geen datum op staat.";

  return (
    <div className="stack">
      <div>
        <h1 className="h1">Inboeken</h1>
        <p className="lead">Een levering of een nieuwe prep toevoegen.</p>
      </div>

      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <span>Product</span>
          {product ? (
            <div className="picked">
              <b>{product.name}</b>
              <button type="button" className="btn small" onClick={clearPick}>
                Wijzig
              </button>
            </div>
          ) : (
            <>
              <input
                className="input"
                id="ib-q"
                placeholder="Zoek of typ een nieuw product"
                autoComplete="off"
                aria-label="Product"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsNew(false);
                }}
                onFocus={() => setFocused(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (hits[0]) pick(hits[0].id);
                    else if (query.trim()) setIsNew(true);
                  }
                }}
              />
              {focused && query.trim() && !isNew && (
                <div className="sugg">
                  {hits.map((p) => (
                    <button type="button" key={p.id} onClick={() => pick(p.id)}>
                      <span>{p.name}</span>
                      <small>{p.unit}</small>
                    </button>
                  ))}
                  {!exact && (
                    <button type="button" onClick={() => setIsNew(true)}>
                      <span>
                        Nieuw product: <b>{query.trim()}</b>
                      </span>
                      <small>toevoegen</small>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {isNew && !product && (
          <div className="newbox">
            <div className="h3">Nieuw product</div>
            <ProductFields
              value={newForm}
              onChange={changeNewForm}
              idPrefix="np"
              suppliers={suppliers}
              extraCategories={products.map((p) => p.category)}
            />
          </div>
        )}

        <div className="field">
          <span>Aantal</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div className="stepper">
              <button type="button" aria-label="Minder" onClick={() => step(-1)}>
                −
              </button>
              <input
                id="ib-qty"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                aria-label="Aantal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
              <button type="button" aria-label="Meer" onClick={() => step(1)}>
                +
              </button>
            </div>
            <span className="h3">{product?.unit ?? (isNew ? newForm.unit : "")}</span>
          </div>
        </div>

        <div className="grid2 wrap1">
          <label className="field">
            <span>{isPrep ? "Geprept op" : "Geleverd op"}</span>
            <input className="input" id="ib-recv" type="date" value={received} onChange={(e) => changeReceived(e.target.value)} />
          </label>
          <label className="field">
            <span>Houdbaar tot</span>
            <input className="input" id="ib-exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
            <small>{expHelp}</small>
          </label>
        </div>

        <div className="quick" aria-label="Snel een houdbaarheid kiezen">
          {QUICK_DAYS.map((d) => (
            <button type="button" key={d} className="chip" onClick={() => setExpires(addDays(received || todayISO(), d))}>
              +{d} {d === 1 ? "dag" : "dagen"}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Opmerking</span>
          <input
            className="input"
            id="ib-note"
            placeholder="Optioneel, bv. leverancier of lotnummer"
            autoComplete="off"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? "Bezig…" : "Inboeken"}
        </button>
      </form>

      {!!recent.length && (
        <section>
          <SectionHead title="Vandaag ingeboekt" count={recent.length} />
          <div className="list">
            {recent.map((b) => {
              const p = productMap.get(b.productId)!;
              const time = new Date(b.createdAt).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
              return (
                <Row key={b.id} onOpen={() => openProduct(p.id)}>
                  <div className="row-main">
                    <div className="name">{p.name}</div>
                    <div className="meta">
                      <span>
                        {time}
                        {b.createdBy ? ` · door ${b.createdBy}` : ""}
                      </span>
                      <ExpTag b={b} warnDays={data.settings.warnDays} />
                    </div>
                  </div>
                  <div className="row-side">
                    <Qty n={b.qty} unit={p.unit} />
                  </div>
                </Row>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
