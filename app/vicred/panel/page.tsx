"use client";

import { useEffect, useState } from "react";

export default function VicredPanelPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/vicred/me")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || "Error");
        return j;
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div style={{ padding: 20 }}>Error: {error}</div>;
  if (!data) return <div style={{ padding: 20 }}>Cargando...</div>;

  const { cliente, estado, cuotas } = data;

  const waMsg = `Hola, quiero realizar un pago de mi crédito Vicred.%0A` +
    `DNI: ${cliente?.dni}%0A` +
    `Nº Vicred: ${cliente?.vicred_id}`;

  // Si no querés usar el teléfono del cliente, poné el número fijo de Vicred:
  const waLink = `https://wa.me/?text=${waMsg}`;

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1>VICRED — Portal Cliente</h1>

      <div style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 10 }}>
        <h3>Cliente</h3>
        <div><b>Nombre:</b> {cliente?.nombre}</div>
        <div><b>DNI:</b> {cliente?.dni}</div>
        <div><b>Nº Vicred:</b> {cliente?.vicred_id}</div>
      </div>

      <div style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 10 }}>
        <h3>Estado de crédito</h3>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(estado, null, 2)}</pre>
      </div>

      <div style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 10 }}>
        <h3>Cuotas pendientes</h3>
        {cuotas?.length ? (
          <ul>
            {cuotas.map((c: any) => (
              <li key={c.id}>
                Cuota {c.nro_cuota} — vence {String(c.vencimiento).slice(0, 10)} — ${c.monto} — {c.estado}
              </li>
            ))}
          </ul>
        ) : (
          <div>No tenés cuotas pendientes ✅</div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <a href={waLink} target="_blank" rel="noreferrer">
          <button style={{ padding: 12, cursor: "pointer" }}>Contactar por WhatsApp</button>
        </a>
      </div>
    </div>
  );
}
