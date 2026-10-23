"use client";

import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) return setError("Vul het teamwachtwoord in.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Inloggen lukte niet.");
    } catch {
      setError("Geen verbinding. Probeer opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="center">
      <form className="card" onSubmit={submit} noValidate>
        <div>
          <img
            src="logo.svg"
            alt="Cantine"
            width={72}
            height={72}
            style={{ display: "block", marginBottom: 12 }}
          />
          <h1 className="h1">Stocklijst</h1>
          <p className="lead">Cantine · log in met het teamwachtwoord</p>
        </div>
        <label className="field">
          <span>Teamwachtwoord</span>
          <input
            className="input"
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? "Even geduld…" : "Inloggen"}
        </button>
      </form>
    </main>
  );
}
