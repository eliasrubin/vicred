"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VicredIngresarPage() {
  const router = useRouter();
  const [dni, setDni] = useState("");
  const [clave, setClave] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/vicred/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dni, clave }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLoading(false);
      setError(data?.error ?? "No se pudo ingresar");
      return;
    }

    // Login ok (cookie seteada). Vamos al panel
    router.push("/vicred/panel");
  }

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 16 }}>
      <h1 style={{ fontSize: 32, marginBottom: 6 }}>VICRED</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>Portal Cliente</p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label>
          DNI
          <input
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            inputMode="numeric"
            placeholder="Ej: 37086370"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Clave (6 dígitos)
          <input
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            inputMode="numeric"
            placeholder="Ej: 000001"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <button disabled={loading} style={{ padding: 12 }}>
          {loading ? "Ingresando..." : "Ingresar"}
        </button>

        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </form>
    </div>
  );
}
