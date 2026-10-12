"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Batch } from "@/lib/types";
import { daysBetween, fmtDate, fmtNum, relDays, todayISO } from "@/lib/stock";
import { Icon } from "./Icons";

/** Vervaldatum op een "tape"-label, met een waarschuwing als het dringend is. */
export function ExpTag({ b, warnDays }: { b: Batch; warnDays: number }) {
  if (!b.expires) return null;
  const d = daysBetween(todayISO(), b.expires);
  const cls = d < 0 ? "bad" : d <= warnDays ? "warn" : null;
  return (
    <>
      <span className="tape">{fmtDate(b.expires)}</span>
      {cls && <span className={`pill ${cls}`}>{relDays(d)}</span>}
    </>
  );
}

export function Qty({ n, unit }: { n: number; unit: string }) {
  return (
    <div className={`qty${n ? "" : " out"}`}>
      <b>{fmtNum(n)}</b>
      <span>{unit}</span>
    </div>
  );
}

/** Een rij die je kunt aantikken (en met Enter/spatie kunt openen). */
export function Row({ onOpen, children }: { onOpen?: () => void; children: ReactNode }) {
  if (!onOpen) return <div className="row">{children}</div>;
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onOpen();
    }
  };
  return (
    <div className="row click" role="button" tabIndex={0} onClick={onOpen} onKeyDown={onKey}>
      {children}
    </div>
  );
}

export function MinusButton({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      className="minus"
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      −1
    </button>
  );
}

/** Onderblad (gsm) of venster (groot scherm). Sluit met Escape of door naast te tikken. */
export function Sheet({
  title,
  sub,
  onClose,
  children,
}: {
  title: string;
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div
      className="scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="sheet-head">
          <div>
            <h2 className="h2" id="sheet-title">{title}</h2>
            {sub && <p className="lead">{sub}</p>}
          </div>
          <button className="icon-btn" aria-label="Sluiten" onClick={onClose} ref={closeRef}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Knop die eerst om bevestiging vraagt ("Zeker? Tik nog eens"). */
export function ConfirmButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`btn danger${armed ? " armed" : ""}`}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

export function SectionHead({ title, count, extra }: { title: string; count?: number; extra?: ReactNode }) {
  return (
    <div className="section-head">
      <h2 className="h3">
        {title}
        {count !== undefined && (
          <>
            {" · "}
            <b>{count}</b>
          </>
        )}
      </h2>
      {extra}
    </div>
  );
}
