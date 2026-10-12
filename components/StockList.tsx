"use client";

import { useState } from "react";
import { useStock } from "./StockApp";
import { ExpTag, MinusButton, Qty, Row } from "./ui";
import { Icon } from "./Icons";
import { byCategory, fmtMoney, needsOrder, norm } from "@/lib/stock";
import type { Product } from "@/lib/types";

export default function StockList() {
  const { products, infoOf, data, consumeOne, openProduct } = useStock();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Alles");

  const cats = [...new Set(products.map((p) => p.category || "Overige"))].sort(byCategory);
  const lowCount = products.filter((p) => needsOrder(p, infoOf(p))).length;
  const priced = products.filter((p) => p.price != null);
  const stockValue = priced.reduce((s, p) => s + (p.price ?? 0) * infoOf(p).total, 0);

  const nq = norm(q.trim());
  let list = products.filter((p) => !nq || norm(p.name).includes(nq));
  if (cat === "Laag") list = list.filter((p) => needsOrder(p, infoOf(p)));
  else if (cat !== "Alles") list = list.filter((p) => (p.category || "Overige") === cat);

  const groups = new Map<string, Product[]>();
  for (const p of list) {
    const c = p.category || "Overige";
    groups.set(c, [...(groups.get(c) ?? []), p]);
  }
  const order = [...groups.keys()].sort(byCategory);

  const chip = (value: string, label: string) => (
    <button key={value} className="chip" aria-pressed={cat === value} onClick={() => setCat(value)}>
      {label}
    </button>
  );

  return (
    <>
      <div className="search">
        <Icon name="search" />
        <input
          id="stock-q"
          type="search"
          placeholder="Zoek product"
          autoComplete="off"
          aria-label="Zoek product"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="chips">
        {chip("Alles", "Alles")}
        {!!lowCount && chip("Laag", `Bijbestellen (${lowCount})`)}
        {cats.map((c) => chip(c, c))}
      </div>
      {priced.length > 0 && (
        <div className="summary-line" style={{ marginTop: 8 }}>
          <span>
            Stockwaarde
            {priced.length < products.length ? ` (${priced.length} van ${products.length} producten met prijs)` : ""}
          </span>
          <span className="money">{fmtMoney(stockValue)}</span>
        </div>
      )}

      {!list.length ? (
        <div className="empty" style={{ marginTop: 16 }}>
          {q ? (
            <>
              Geen product gevonden voor “{q}”. Voeg het toe via <b>Inboeken</b>.
            </>
          ) : (
            "Nog geen producten in deze lijst."
          )}
        </div>
      ) : (
        order.map((c) => (
          <div key={c}>
            <div className="group-title">
              <h2 className="h3">{c}</h2>
              <span className="h3">{groups.get(c)!.length}</span>
            </div>
            <div className="list">
              {groups.get(c)!.map((p) => {
                const i = infoOf(p);
                return (
                  <Row key={p.id} onOpen={() => openProduct(p.id)}>
                    <div className="row-main">
                      <div className="name">{p.name}</div>
                      {(i.next || i.low !== "ok" || p.prep || p.location) && (
                        <div className="meta">
                          {i.next && <ExpTag b={i.next} warnDays={data.settings.warnDays} />}
                          {i.low === "op" && <span className="pill bad">Op</span>}
                          {i.low === "laag" && <span className="pill low">Bijbestellen</span>}
                          {p.prep && <span className="pill plain">Prep</span>}
                          {p.location && <span>{p.location}</span>}
                        </div>
                      )}
                    </div>
                    <div className="row-side">
                      <Qty n={i.total} unit={p.unit} />
                      <MinusButton label={`Eén ${p.name} gebruikt`} disabled={i.total <= 0} onClick={() => consumeOne(p.id)} />
                    </div>
                  </Row>
                );
              })}
            </div>
          </div>
        ))
      )}

      <div style={{ marginTop: 20 }}>
        <button className="btn block" onClick={() => openProduct(null)}>
          Nieuw product toevoegen
        </button>
      </div>
    </>
  );
}
