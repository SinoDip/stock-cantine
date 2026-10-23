"use client";

import { useEffect, useState } from "react";
import { useStock } from "./StockApp";
import { Icon } from "./Icons";
import { AREAS, AREA_LABEL, byCategory, fmtNum, norm } from "@/lib/stock";
import type { Area, Product } from "@/lib/types";

const DRAFT_KEY = "stocklijst.telling.";

function readDraft(area: Area): Record<string, string> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY + area);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function writeDraft(area: Area, counts: Record<string, string>) {
  try {
    if (Object.keys(counts).length) localStorage.setItem(DRAFT_KEY + area, JSON.stringify(counts));
    else localStorage.removeItem(DRAFT_KEY + area);
  } catch {
    /* negeren */
  }
}

const parse = (v: string | undefined) => (v == null || v.trim() === "" ? null : Number(v.replace(",", ".")));

/** Stock tellen: per kant overlopen wat er echt staat en de stock daarop zetten. */
export default function Telling() {
  const { products, infoOf, area: lastArea, setArea: rememberArea, saveCount, toast } = useStock();
  const [area, setArea] = useState<Area>(lastArea);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);

  // Een halve telling blijft bewaard op dit toestel, ook als je even naar een ander scherm gaat.
  useEffect(() => setCounts(readDraft(area)), [area]);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);

  const update = (pid: string, v: string | null) =>
    setCounts((c) => {
      const n = { ...c };
      if (v == null) delete n[pid];
      else n[pid] = v;
      writeDraft(area, n);
      return n;
    });

  const inArea = products.filter((p) => p.areas.includes(area));
  const shown = q.trim() ? inArea.filter((p) => norm(p.name).includes(norm(q.trim()))) : inArea;
  const groups = new Map<string, Product[]>();
  for (const p of shown) groups.set(p.category || "Overige", [...(groups.get(p.category || "Overige") ?? []), p]);
  const order = [...groups.keys()].sort(byCategory);

  const counted = inArea.filter((p) => parse(counts[p.id]) != null);
  const invalid = counted.filter((p) => !(parse(counts[p.id])! >= 0));
  const diffs = counted.filter((p) => parse(counts[p.id]) !== infoOf(p, area).total);

  async function save() {
    if (invalid.length) return toast(`Kijk het aantal na bij ${invalid[0].name}.`);
    if (!diffs.length) {
      writeDraft(area, {});
      setCounts({});
      return toast("Alles klopte. Niets aangepast.");
    }
    if (!armed) return setArmed(true);
    setArmed(false);
    setBusy(true);
    const changed = await saveCount(
      area,
      diffs.map((p) => ({ productId: p.id, qty: parse(counts[p.id])! })),
    );
    setBusy(false);
    if (changed == null) return;
    writeDraft(area, {});
    setCounts({});
    toast(`Telling ${AREA_LABEL[area]} opgeslagen: ${changed} ${changed === 1 ? "product" : "producten"} aangepast`);
  }

  return (
    <div className="stack">
      <div>
        <h1 className="h1">Stock tellen</h1>
        <p className="lead">
          Loop de {AREA_LABEL[area].toLowerCase()} af en vul in wat er echt staat. Klopt het? Tik op ✓. Lege vakjes blijven zoals ze zijn.
        </p>
      </div>

      <div>
        <div className="seg" role="group" aria-label="Kant">
          {AREAS.map((a) => (
            <button
              type="button"
              key={a}
              aria-pressed={area === a}
              onClick={() => {
                setArea(a);
                rememberArea(a);
              }}
            >
              {AREA_LABEL[a]}
            </button>
          ))}
        </div>
        <div className="search">
          <Icon name="search" />
          <input className="input" type="search" placeholder="Zoek product" aria-label="Zoek product" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="summary-line">
        <span>
          {counted.length} van {inArea.length} geteld
        </span>
        <span>
          {diffs.length} {diffs.length === 1 ? "verschil" : "verschillen"}
        </span>
      </div>

      <div>
        {order.map((c) => (
          <div key={c}>
            <div className="group-title">
              <h2 className="h3">{c}</h2>
              <span className="h3">{groups.get(c)!.length}</span>
            </div>
            <div className="list">
              {groups.get(c)!.map((p) => {
                const now = infoOf(p, area).total;
                const v = parse(counts[p.id]);
                const diff = v != null && v >= 0 ? v - now : null;
                return (
                  <div className="row" key={p.id}>
                    <div className="row-main">
                      <div className="name">{p.name}</div>
                      <div className="meta">
                        <span>
                          app: {fmtNum(now)} {p.unit}
                        </span>
                        {diff === 0 && <span className="pill good">Klopt</span>}
                        {diff != null && diff !== 0 && (
                          <span className={`pill ${diff < 0 ? "bad" : "warn"}`}>
                            {diff > 0 ? "+" : "−"}
                            {fmtNum(Math.abs(diff))}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="row-side" style={{ gap: 6 }}>
                      <input
                        className="input num"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        aria-label={`Geteld ${p.name}`}
                        placeholder="–"
                        style={{ width: 80, textAlign: "center" }}
                        value={counts[p.id] ?? ""}
                        onChange={(e) => update(p.id, e.target.value === "" ? null : e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn small"
                        aria-label={`${p.name} klopt`}
                        aria-pressed={diff === 0}
                        onClick={() => update(p.id, String(now))}
                      >
                        ✓
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {!shown.length && <div className="empty">{q ? `Geen product gevonden voor “${q}”.` : `Nog geen producten in ${AREA_LABEL[area]}.`}</div>}
      </div>

      <div className="actions">
        <button className={`btn primary${armed ? " armed" : ""}`} style={{ flex: 1 }} onClick={save} disabled={busy || !counted.length}>
          {busy
            ? "Bezig…"
            : armed
              ? `Zeker? ${diffs.length} ${diffs.length === 1 ? "product" : "producten"} aanpassen`
              : `Telling opslaan${diffs.length ? ` (${diffs.length} ${diffs.length === 1 ? "verschil" : "verschillen"})` : ""}`}
        </button>
        {counted.length > 0 && (
          <button
            className="btn"
            onClick={() => {
              writeDraft(area, {});
              setCounts({});
            }}
          >
            Wissen
          </button>
        )}
      </div>
      <p className="lead" style={{ fontSize: 14, marginTop: -16 }}>
        Minder dan in de app: er wordt afgetrokken van wat het eerst vervalt. Meer: er komt een levering “Telling” bij zonder vervaldatum.
      </p>
    </div>
  );
}
