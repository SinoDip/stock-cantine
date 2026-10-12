"use client";

import { useStock } from "./StockApp";
import { Row } from "./ui";
import { fmtDays, isoWeekday, needsOrder } from "@/lib/stock";

export default function Suppliers() {
  const { suppliers, products, infoOf, openSupplier } = useStock();
  const today = isoWeekday();

  return (
    <div className="stack">
      <div>
        <h1 className="h1">Leveranciers</h1>
        <p className="lead">Tik op een leverancier om te bellen, te mailen of de gegevens aan te passen.</p>
      </div>

      {suppliers.length ? (
        <div className="list">
          {suppliers.map((s) => {
            const linked = products.filter((p) => p.supplierId === s.id);
            const low = linked.filter((p) => needsOrder(p, infoOf(p))).length;
            const orderToday = s.orderDays.includes(today);
            return (
              <Row key={s.id} onOpen={() => openSupplier(s.id)}>
                <div className="row-main">
                  <div className="name">{s.name}</div>
                  <div className="meta">
                    {orderToday && <span className="pill warn">Vandaag bestellen{s.orderDeadline ? ` voor ${s.orderDeadline}` : ""}</span>}
                    {s.orderDays.length > 0 && <span>Bestellen: {fmtDays(s.orderDays)}</span>}
                    {s.deliveryDays.length > 0 && <span>Levering: {fmtDays(s.deliveryDays)}</span>}
                    {s.phone && <span>{s.phone}</span>}
                  </div>
                </div>
                <div className="row-side">
                  <div className="qty">
                    <b>{linked.length}</b>
                    <span>{low ? `${low} op minimum` : "producten"}</span>
                  </div>
                </div>
              </Row>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          Nog geen leveranciers. Voeg je eerste leverancier toe en koppel daarna je producten aan hem via het product zelf.
        </div>
      )}

      <button className="btn primary block" onClick={() => openSupplier(null)}>
        Nieuwe leverancier
      </button>
    </div>
  );
}
