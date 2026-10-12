"use client";

import { useState, type FormEvent } from "react";
import { useStock } from "./StockApp";

/** Eenmalig per toestel: wie gebruikt de app? */
export default function NamePrompt() {
  const { setMe } = useStock();
  const [name, setName] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) setMe(name.trim().slice(0, 40));
  }

  return (
    <div className="scrim">
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="np-title" onSubmit={submit} noValidate>
        <div>
          <h2 className="h2" id="np-title">Wie ben jij?</h2>
          <p className="lead">Je naam komt bij wat je inboekt. Je vult hem maar één keer in op dit toestel.</p>
        </div>
        <label className="field">
          <span>Voornaam</span>
          <input className="input" id="np-name" autoComplete="given-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="btn primary block" type="submit" disabled={!name.trim()}>
          Verder
        </button>
      </form>
    </div>
  );
}
