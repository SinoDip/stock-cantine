"use client";

import { useState } from "react";
import { useStock } from "./StockApp";
import { Row } from "./ui";
import { Icon } from "./Icons";
import { ALLERGENS, norm } from "@/lib/stock";

/** Allergenen opzoeken: kies een of meer allergenen en zie welke producten ze bevatten. */
export default function Allergens() {
  const { products, openProduct } = useStock();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [hideUnknown, setHideUnknown] = useState(false);

  const nq = norm(q.trim());
  let list = products.filter((p) => !nq || norm(p.name).includes(nq));
  if (picked.length) list = list.filter((p) => picked.some((a) => p.allergens.includes(a)));
  else if (hideUnknown) list = list.filter((p) => p.allergens.length);

  const unknown = products.filter((p) => !p.allergens.length).length;
  const toggle = (a: string) => setPicked((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]));

  return (
    <div className="stack">
      <div>
        <h1 className="h1">Allergenen</h1>
        <p className="lead">
          Kies een allergeen om te zien welke producten het bevatten. Allergenen vul je in bij elk product onder “Product aanpassen”.
        </p>
      </div>

      <div>
        <div className="search">
          <Icon name="search" />
          <input type="search" placeholder="Zoek product" aria-label="Zoek product" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips" style={{ flexWrap: "wrap", overflow: "visible" }}>
          {ALLERGENS.map((a) => (
            <button key={a} className="chip" aria-pressed={picked.includes(a)} onClick={() => toggle(a)}>
              {a}
            </button>
          ))}
          {picked.length > 0 && (
            <button className="chip" onClick={() => setPicked([])}>
              Wis keuze
            </button>
          )}
        </div>
      </div>

      {unknown > 0 && !picked.length && (
        <label className="check" style={{ minHeight: 0 }}>
          <input type="checkbox" checked={hideUnknown} onChange={(e) => setHideUnknown(e.target.checked)} />
          Verberg producten zonder allergeneninfo ({unknown})
        </label>
      )}

      {list.length ? (
        <div className="list">
          {list.map((p) => (
            <Row key={p.id} onOpen={() => openProduct(p.id)}>
              <div className="row-main">
                <div className="name">{p.name}</div>
                <div className="meta">
                  {p.allergens.length ? (
                    p.allergens.map((a) => (
                      <span key={a} className={`pill ${picked.includes(a) ? "bad" : "allergen"}`}>
                        {a}
                      </span>
                    ))
                  ) : (
                    <span className="pill plain">Nog niet ingevuld</span>
                  )}
                </div>
              </div>
            </Row>
          ))}
        </div>
      ) : (
        <div className="empty">
          {picked.length ? `Geen producten met ${picked.join(" of ")}.` : "Geen producten gevonden."}
        </div>
      )}
      <p className="lead" style={{ fontSize: 13 }}>
        Controleer bij twijfel altijd het etiket of de technische fiche van de leverancier.
      </p>
    </div>
  );
}
