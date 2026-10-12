"use client";

import { useState, type FormEvent } from "react";
import { useStock } from "./StockApp";
import { Sheet } from "./ui";

export default function SettingsSheet() {
  const { data, saveSettings, closeSheet, toast, me, setMe } = useStock();
  const [days, setDays] = useState(String(data.settings.warnDays));
  const [name, setName] = useState(me);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = Math.max(0, Math.min(60, Math.round(Number(days) || 0)));
    if (name.trim() && name.trim() !== me) setMe(name.trim());
    if (v !== data.settings.warnDays) {
      const ok = await saveSettings({ warnDays: v });
      if (!ok) return;
    }
    toast("Instellingen opgeslagen");
    closeSheet();
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/login";
  }

  return (
    <Sheet title="Instellingen" sub="De waarschuwing geldt voor het hele team." onClose={closeSheet}>
      <form className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span>Waarschuwen voor de vervaldatum</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              className="input num"
              id="st-days"
              type="number"
              min={0}
              max={60}
              step={1}
              style={{ maxWidth: 120 }}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
            <span>dagen op voorhand</span>
          </div>
          <small>Producten die binnen deze termijn vervallen, komen bij “Eerst gebruiken”.</small>
        </label>
        <label className="field">
          <span>Jouw naam op dit toestel</span>
          <input className="input" id="st-name" value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
          <small>Zo zie je wie een levering heeft ingeboekt.</small>
        </label>
        <div className="actions">
          <button className="btn primary" type="submit">
            Opslaan
          </button>
          <button className="btn" type="button" onClick={logout}>
            Uitloggen
          </button>
        </div>
      </form>
    </Sheet>
  );
}
