"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [dni, setDni] = useState("");
  const [clave, setClave] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    setLoading(true);

    try {
      const res = await fetch("/api/vicred/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dni, clave }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMensaje(data?.error || "No se pudo iniciar sesión.");
        setLoading(false);
        return;
      }

      // Si el login fue OK, el backend setea la cookie y redirigimos al panel
      router.push("/vicred/panel");
      router.refresh();
    } catch (err) {
      setMensaje("Error de conexión. Probá de nuevo.");
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 420, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Portal de Clientes Vicred</h1>
      <p style={{ marginBottom: 24 }}>Ingresá con tu DNI y tu clave.</p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>DNI</span>
          <input
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            inputMode="numeric"
            placeholder="Ej: 30123456"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Clave</span>
          <input
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="Ej: 123456"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>

        <button
          type="submit"
          disabled={loading || !dni || !clave}
          style={{
            padding: 12,
            borderRadius: 10,
            border: "none",
            cursor: loading ? "default" : "pointer",
            opacity: loading || !dni || !clave ? 0.6 : 1,
          }}
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>

        {mensaje && (
          <div style={{ padding: 10, borderRadius: 8, border: "1px solid #f0c2c2" }}>
            {mensaje}
          </div>
        )}
      </form>
    </main>
  );
}
