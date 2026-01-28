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

  if (!cliente) return <div style={{ padding: 20 }}>No autorizado</div>;

  const cuotasOrdenadas = useMemo(() => {
    return [...cuotas].sort((a: any, b: any) => {
      const fa = String(a?.vencimiento ?? "");
      const fb = String(b?.vencimiento ?? "");
      if (fa < fb) return -1;
      if (fa > fb) return 1;
      return Number(a?.nro ?? 0) - Number(b?.nro ?? 0);
    });
  }, [cuotas]);

  const cuotasPendientes = useMemo(() => {
    return cuotasOrdenadas.filter((c: any) => String(c?.estado || "").toUpperCase() !== "PAGADA");
  }, [cuotasOrdenadas]);

  const cuotasPagadas = useMemo(() => {
    return cuotasOrdenadas.filter((c: any) => String(c?.estado || "").toUpperCase() === "PAGADA");
  }, [cuotasOrdenadas]);

  // Agrupar por venta (factura)
  const cuotasByVenta = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const c of cuotasOrdenadas) {
      const ventaId = c?.venta_id || c?.venta?.id || "sin-venta";
      if (!map[ventaId]) map[ventaId] = [];
      map[ventaId].push(c);
    }
    return map;
  }, [cuotasOrdenadas]);

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
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );

  const Row = ({ label, value }: any) => (
    <div style={{ display: "flex", gap: 10, padding: "6px 0" }}>
      <div style={{ width: 190, color: "#555" }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value ?? "-"}</div>
    </div>
  );

  const Badge = ({ text }: { text: string }) => (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid #ddd",
        fontSize: 13,
        background: "#fafafa",
      }}
    >
      {text}
    </span>
  );

  // WhatsApp
  const waMsg =
    `Hola, quiero realizar un pago de mi crédito Vicred.\n` +
    `DNI: ${cliente?.dni ?? "-"}\n` +
    `N° Vicred: ${cliente?.vicred_id ?? "-"}`;

  const waLink = `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

  return (
    <div style={{ maxWidth: 950, margin: "36px auto", padding: 16 }}>
      <h1 style={{ margin: 0 }}>VICRED — Portal Cliente</h1>
      <p style={{ marginTop: 8, color: "#666" }}>
        Acá podés ver tu crédito, tus cuotas y el detalle de cada compra.
      </p>

      <Card title="Cliente">
        <Row label="Nombre" value={cliente?.nombre || "-"} />
        <Row label="DNI" value={cliente?.dni || "-"} />
        <Row label="N° Vicred" value={cliente?.vicred_id || "-"} />
      </Card>

      <Card title="Tu crédito">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
            <div style={{ color: "#666", fontSize: 13 }}>Límite</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{formatMoney(estado?.limite)}</div>
          </div>

          <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
            <div style={{ color: "#666", fontSize: 13 }}>Disponible</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{formatMoney(estado?.disponible)}</div>
          </div>

          <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
            <div style={{ color: "#666", fontSize: 13 }}>Deuda total</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{formatMoney(estado?.deuda_total)}</div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Badge text={`Pendientes: ${estado?.cuotas_pendientes ?? cuotasPendientes.length ?? 0}`} />
          <Badge text={`Pagadas: ${estado?.cuotas_pagadas ?? cuotasPagadas.length ?? 0}`} />
          <Badge text={`Próximo vencimiento: ${formatDate(estado?.proximo_vencimiento)}`} />
        </div>
      </Card>

      <Card title="Cuotas (por factura)">
        {Object.keys(cuotasByVenta).length ? (
          <div style={{ display: "grid", gap: 14 }}>
            {Object.entries(cuotasByVenta).map(([ventaId, items]) => {
              const venta = items?.[0]?.venta;
              const facturaNumero =
                venta?.factura_numero ?? venta?.facturaNumero ?? venta?.factura ?? "Sin número";
              const fechaVenta = venta?.fecha ? formatDate(venta.fecha) : "-";
              const totalVenta = venta?.total != null ? formatMoney(venta.total) : "-";
              const anticipo = venta?.anticipo != null ? formatMoney(venta.anticipo) : "-";

              return (
                <div
                  key={ventaId}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 14,
                    padding: 14,
                    background: "#fff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>
                        Factura:{" "}
                        <a href={`/vicred/venta/${ventaId}`} style={{ textDecoration: "underline" }}>
                          {String(facturaNumero)}
                        </a>
                      </div>
                      <div style={{ color: "#666", marginTop: 4 }}>
                        Fecha: {fechaVenta} · Total: {totalVenta} · Anticipo: {anticipo}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Badge text={`${items.length} cuota(s)`} />
                    </div>
                  </div>

                  <div style={{ marginTop: 10, overflowX: "auto" }}>
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
                          <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", color: "#666" }}>
                            Pago
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {items.map((c: any) => {
                          const nro = c?.nro ?? "-";
                          const venc = c?.vencimiento;
                          const imp = c?.importe ?? 0;
                          const est = String(c?.estado ?? "PENDIENTE").toUpperCase();
                          const pagoFecha = c?.pago_fecha;

                          const linkCuotaPagada = est === "PAGADA" ? `/vicred/venta/${ventaId}#pagos` : null;

                          return (
                            <tr key={c?.id ?? `${ventaId}-${nro}-${String(venc)}`}>
                              <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2", fontWeight: 800 }}>
                                #{nro}
                              </td>
                              <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>
                                {formatDate(venc)}
                              </td>
                              <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>
                                {formatMoney(imp)}
                              </td>
                              <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>
                                <Badge text={est} />
                              </td>
                              <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>
                                {est === "PAGADA" ? (
                                  linkCuotaPagada ? (
                                    <a href={linkCuotaPagada} style={{ textDecoration: "underline", fontWeight: 700 }}>
                                      {pagoFecha ? `Pagada el ${formatDate(pagoFecha)}` : "Ver pago"}
                                    </a>
                                  ) : (
                                    <span style={{ fontWeight: 700 }}>
                                      {pagoFecha ? `Pagada el ${formatDate(pagoFecha)}` : "Pagada"}
                                    </span>
                                  )
                                ) : (
                                  <span style={{ color: "#666" }}>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div>No hay cuotas para mostrar.</div>
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
              fontWeight: 800,
            }}
          >
            Contactar por WhatsApp
          </button>
        </a>
      </div>
    </div>
  );
}
