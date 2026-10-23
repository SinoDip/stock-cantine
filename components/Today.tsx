"use client";

import { useStock } from "./StockApp";
import { ExpTag, MinusButton, Qty, Row, SectionHead } from "./ui";
import { AREA_LABEL, daysBetween, expectedDelivery, fifo, fmtDate, fmtDuration, fmtNum, isoWeekday, longDate, minutesUntil, todayISO } from "@/lib/stock";
import type { Batch } from "@/lib/types";

export default function Today() {
  const { data, products, productMap, suppliers, supplierMap, infoOf, shouldOrder, openProduct, consumeBatch, discard, goTab } = useToday();
  const w = data.settings.warnDays;
  const t = todayISO();
  const all = data.batches.filter((b) => b.remaining > 0 && productMap.has(b.productId));
  const expired = all.filter((b) => b.expires && b.expires < t).sort(fifo);
  const soon = all.filter((b) => b.expires && b.expires >= t && daysBetween(t, b.expires) <= w).sort(fifo);
  const low = products.filter(shouldOrder);
  const arriving = data.orders
    .map((o) => ({ o, s: o.supplierId ? supplierMap.get(o.supplierId) : undefined }))
    .map((x) => ({ ...x, exp: expectedDelivery(x.o, x.s) }))
    .filter((x) => x.exp && x.exp <= t);
  const prepNoDate = all.filter((b) => productMap.get(b.productId)?.prep && !b.expires);
  const weekday = isoWeekday();
  const orderToday = suppliers
    .filter((s) => s.orderDays.includes(weekday))
    .map((s) => {
      const lowCount = low.filter((p) => p.supplierId === s.id).length;
      const left = s.orderDeadline ? minutesUntil(s.orderDeadline) : null;
      return { s, lowCount, left };
    })
    .sort((a, b) => (a.left ?? 9999) - (b.left ?? 9999));

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const batchRow = (b: Batch, kind: "expired" | "soon") => {
    const p = productMap.get(b.productId)!;
    return (
      <Row key={b.id} onOpen={() => openProduct(p.id)}>
        <div className="row-main">
          <div className="name">{p.name}</div>
          <div className="meta">
            <span className="pill area">{AREA_LABEL[b.area]}</span>
            <ExpTag b={b} warnDays={w} />
          </div>
        </div>
        <div className="row-side">
          <Qty n={b.remaining} unit={p.unit} />
          {kind === "expired" ? (
            <button
              className="btn small danger"
              onClick={(e) => {
                e.stopPropagation();
                discard(b);
              }}
            >
              Weggegooid
            </button>
          ) : (
            <MinusButton label={`Eén ${p.name} gebruikt`} onClick={() => consumeBatch(b)} />
          )}
        </div>
      </Row>
    );
  };

  const tile = (cls: string, n: number, label: string, target: string) => (
    <button className={`tile ${cls}${n ? "" : " zero"}`} onClick={() => jump(target)}>
      <b className="num">{n}</b>
      <span>{label}</span>
    </button>
  );

  const nothing = !expired.length && !soon.length && !low.length && !prepNoDate.length;

  return (
    <div className="stack">
      <div>
        <h1 className="h1">Vandaag</h1>
        <p className="lead" suppressHydrationWarning>
          {longDate()} · waarschuwing {w} {w === 1 ? "dag" : "dagen"} voor de vervaldatum
        </p>
      </div>

      <div className="tiles">
        {tile("bad", expired.length, "Vervallen", "s-expired")}
        {tile("warn", soon.length, "Eerst gebruiken", "s-soon")}
        {tile("low", low.length, "Bijbestellen", "s-low")}
      </div>

      {!!orderToday.length && (
        <section id="s-order">
          <SectionHead title="Vandaag bestellen" count={orderToday.length} />
          <div className="list">
            {orderToday.map(({ s, lowCount, left }) => (
              <Row key={s.id} onOpen={() => goTab("bestellen", { supplierId: s.id })}>
                <div className="row-main">
                  <div className="name">{s.name}</div>
                  <div className="meta">
                    {s.orderDeadline && left != null ? (
                      left < 0 ? (
                        <span className="pill plain">Deadline {s.orderDeadline} voorbij</span>
                      ) : (
                        <span className={`pill ${left <= 120 ? "bad" : "warn"}`}>
                          Voor {s.orderDeadline} · nog {fmtDuration(left)}
                        </span>
                      )
                    ) : (
                      <span className="pill warn">Besteldag</span>
                    )}
                    <span>{lowCount ? `${lowCount} ${lowCount === 1 ? "product" : "producten"} op minimum` : "niets onder minimum"}</span>
                  </div>
                </div>
                <div className="row-side">
                  <span className="btn small">Bestellijst</span>
                </div>
              </Row>
            ))}
          </div>
        </section>
      )}

      {!!arriving.length && (
        <section id="s-arriving">
          <SectionHead title="Levering verwacht" count={arriving.length} />
          <div className="list">
            {arriving.map(({ o, s, exp }) => (
              <Row key={o.id} onOpen={() => goTab("inboeken", { orderId: o.id })}>
                <div className="row-main">
                  <div className="name">{s?.name ?? "Zonder leverancier"}</div>
                  <div className="meta">
                    {exp! < t && <span className="pill bad">Verwacht {fmtDate(exp)}</span>}
                    <span>
                      {o.lines.length} {o.lines.length === 1 ? "product" : "producten"} besteld
                    </span>
                  </div>
                </div>
                <div className="row-side">
                  <span className="btn small">Inboeken</span>
                </div>
              </Row>
            ))}
          </div>
        </section>
      )}

      {!!expired.length && (
        <section id="s-expired">
          <SectionHead title="Vervallen, nakijken en wegdoen" count={expired.length} />
          <div className="list">{expired.map((b) => batchRow(b, "expired"))}</div>
        </section>
      )}

      {!!soon.length && (
        <section id="s-soon">
          <SectionHead title="Eerst gebruiken" count={soon.length} />
          <div className="list">{soon.map((b) => batchRow(b, "soon"))}</div>
        </section>
      )}

      {!!low.length && (
        <section id="s-low">
          <SectionHead
            title="Bijbestellen"
            count={low.length}
            extra={
              <button className="linkish" onClick={() => goTab("bestellen")}>
                Naar bestellijst{low.length > 8 ? ` (${low.length})` : ""}
              </button>
            }
          />
          <div className="list">
            {low.slice(0, 8).map((p) => {
              const i = infoOf(p);
              return (
                <Row key={p.id} onOpen={() => openProduct(p.id)}>
                  <div className="row-main">
                    <div className="name">{p.name}</div>
                    <div className="meta">
                      {i.low === "op" ? <span className="pill bad">Op</span> : <span className="pill low">Op minimum</span>}
                      <span>minimum {fmtNum(p.min ?? 0)}</span>
                    </div>
                  </div>
                  <div className="row-side">
                    <Qty n={i.total} unit={p.unit} />
                  </div>
                </Row>
              );
            })}
          </div>
        </section>
      )}

      {!!prepNoDate.length && (
        <section id="s-prep">
          <SectionHead title="Prep zonder vervaldatum" count={prepNoDate.length} />
          <div className="list">
            {prepNoDate.map((b) => {
              const p = productMap.get(b.productId)!;
              return (
                <Row key={b.id} onOpen={() => openProduct(p.id)}>
                  <div className="row-main">
                    <div className="name">{p.name}</div>
                    <div className="meta">
                      <span className="pill area">{AREA_LABEL[b.area]}</span>
                      <span>Geprept op {fmtDate(b.received)}</span>
                      {!p.shelfDays && <span className="pill plain">Houdbaarheid niet ingesteld</span>}
                    </div>
                  </div>
                  <div className="row-side">
                    <span className="btn small">Datum invullen</span>
                  </div>
                </Row>
              );
            })}
          </div>
        </section>
      )}

      {nothing && !!products.length && (
        <div className="empty">Alles in orde. Niets vervalt binnen {w} dagen en alles zit boven het minimum.</div>
      )}
      {!products.length && (
        <div className="empty">
          Nog geen producten. Ga naar <b>Inboeken</b> om de eerste levering toe te voegen.
        </div>
      )}
    </div>
  );
}

/** Eén stuk van een specifieke levering gebruiken (met ongedaan maken). */
function useToday() {
  const s = useStock();
  const consumeBatch = (b: Batch) => {
    const p = s.productMap.get(b.productId);
    const before = { ...b };
    s.adjust(b, -1);
    s.toast(`${p?.name ?? "Product"} (${AREA_LABEL[b.area]}): −1`, "Ongedaan", () => s.restore(before));
  };
  return { ...s, consumeBatch };
}
