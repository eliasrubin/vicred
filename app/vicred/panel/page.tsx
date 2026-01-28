"use client";

import { useEffect, useMemo, useState } from "react";

function formatMoney(n: any) {
  const num = Number(n ?? 0);
  if (Number.isNaN(num)) return "$0";
  return num.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function formatDate(d: any) {
  if (!d) return "-";
  const s = String(d).slice(0, 10);
  const parts = s.split("-");
  if (parts.length !== 3) return s;
  const [y, m, dd] = parts;
  return `${dd}/${m}/${y}`;
}

export default function VicredPanelPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/vicred/me", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || "Error");
        return j;
      })
      .then((j) => {
        // Blindaje: si viene raro, lo normalizamos
        setData({
          cliente: j?.cliente ?? null,
          estado: j?.estado ?? {},
          cuotas: Array.isArray(j?.cuotas) ? j.cuotas : [],
        });
      })
      .catch((e) => setError(e?.message || "Error"));
  }, []);

  if (error) return <div style={{ padding: 20 }}>Error: {error}</div>;
  if (!data) return <div style={{ padding: 20 }}>Cargando...</div>;

  const cliente = data?.cliente;
  const estado = data?.estado ?? {};
  const cuotas = Array.isArray(data?.cuotas) ? data.cuotas : [];

  if (!cliente) {
    return <div style={{ padding: 20 }}>No autorizado</div>;
  }

  const cuotasPendientes = useMemo(() => {
    return cuotas.filter((c: any) => String(c?.estado || "").toUpperCase() !== "PAGADA");
  }, [cuotas]);

  const waMsg =
    `Hola, quiero realizar un pago de mi crédito Vicred.\n` +
    `DNI: ${cliente?.dni ?? "-"}\n` +
    `Nº Vicred: ${cliente?.vicred_id ?? "-"}`;

  const waLink = `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

  const Card = ({ title, children }: any) => (
    <div
      style={{
        marginTop: 16,
        padding: 18,
        border: "1px solid #e5e5e5",
        borderRadius: 14,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );

  const Row = ({ label, value }: any) => (
    <div style={{ display: "flex", gap: 10, padding: "6px 0" }}>
      <div style={{ width: 170, color: "#555" }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value ?? "-"}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "36px auto", padding: 16 }}>
      <h1 style={{ margin: 0 }}>VICRED — Portal Cliente</h1>
      <p style={{ marginTop: 8, color: "#666" }}>
        Acá podés ver tu estado y las cuotas pendientes.
      </p>

      <Card title="Cliente">
        <Row label="Nombre" value={cliente?.nombre || "-"} />
        <Row label="DNI" value={cliente?.dni || "-"} />
        <Row label="Nº Vicred" value={cliente?.vicred_id || "-"} />
      </Card>

      <Card title="Estado de tu crédito">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
            <div style={{ color: "#666", fontSize: 13 }}>Total pagado</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {formatMoney(estado?.total_pagado)}
            </div>
          </div>

          <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
            <div style={{ color: "#666", fontSize: 13 }}>Total pendiente</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {formatMoney(estado?.total_pendiente)}
            </div>
          </div>

          <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
            <div style={{ color: "#666", fontSize: 13 }}>Cuotas pendientes</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {estado?.cuotas_pendientes ?? cuotasPendientes.length ?? 0}
            </div>
          </div>

          <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
            <div style={{ color: "#666", fontSize: 13 }}>Próximo vencimiento</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {formatDate(estado?.proxima_vencimiento)}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Cuotas pendientes">
        {cuotasPendientes.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", color: "#666" }}>
                    Cuota
                  </th>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", color: "#666" }}>
                    Vence
                  </th>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", color: "#666" }}>
                    Importe
                  </th>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", color: "#666" }}>
                    Estado
                  </th>
                </tr>
              </thead>

              <tbody>
                {cuotasPendientes.map((c: any) => {
                  const nro = c?.nro ?? c?.nro_cuota ?? "-";
                  const venc = c?.vencimiento ?? c?.vencimiento_fecha ?? c?.fecha_vencimiento;
                  const imp = c?.importe ?? c?.monto ?? 0;
                  const est = String(c?.estado ?? "PENDIENTE").toUpperCase();

                  return (
                    <tr key={c?.id ?? `${nro}-${String(venc)}`}>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2", fontWeight: 700 }}>
                        #{nro}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>
                        {formatDate(venc)}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>
                        {formatMoney(imp)}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>
                        <span style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid #ddd", fontSize: 13 }}>
                          {est}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div>No tenés cuotas pendientes ✅</div>
        )}
      </Card>

      <div style={{ marginTop: 16 }}>
        <a href={waLink} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
          <button
            style={{
              padding: "12px 16px",
              cursor: "pointer",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fff",
              fontWeight: 700,
            }}
          >
            Contactar por WhatsApp
          </button>
        </a>
      </div>
    </div>
  );
}
