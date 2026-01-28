"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

export default function VentaDetallePage() {
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/vicred/venta/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || "Error");
        return j;
      })
      .then(setData)
      .catch((e) => setError(e?.message || "Error"));
  }, [id]);

  if (error) return <div style={{ padding: 20 }}>Error: {error}</div>;
  if (!data) return <div style={{ padding: 20 }}>Cargando...</div>;

  const { venta, cuotas } = data;

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
      <div style={{ width: 200, color: "#555" }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value ?? "-"}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "36px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Detalle de Venta</h1>
        <Link href="/vicred/panel" style={{ textDecoration: "none" }}>
          ← Volver al panel
        </Link>
      </div>

      <Card title={`Factura: ${venta?.factura_numero ?? "-"}`}>
        <Row label="Fecha" value={formatDate(venta?.fecha)} />
        <Row label="Total" value={formatMoney(venta?.total)} />
        <Row label="Anticipo" value={formatMoney(venta?.anticipo)} />
        <Row label="Cantidad de cuotas" value={venta?.cuotas_cantidad ?? "-"} />
        <Row label="Comercio ID" value={venta?.comercio_id ?? "-"} />
        <Row label="Primer vencimiento" value={formatDate(venta?.primer_vencimiento)} />
        <Row label="Observación" value={venta?.observacion ?? "-"} />
      </Card>

      <Card title="Cuotas de esta venta">
        {Array.isArray(cuotas) && cuotas.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", color: "#666" }}>Cuota</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", color: "#666" }}>Vence</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", color: "#666" }}>Importe</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", color: "#666" }}>Pagado</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", color: "#666" }}>Estado</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", color: "#666" }}>Pago</th>
                </tr>
              </thead>
              <tbody>
                {cuotas.map((c: any) => {
                  const est = String(c?.estado ?? "").toUpperCase();
                  const pagoFecha = c?.pago_fecha ? formatDate(c.pago_fecha) : "-";
                  return (
                    <tr key={c.id}>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2", fontWeight: 800 }}>
                        <Link href={`/vicred/cuota/${c.id}`} style={{ textDecoration: "none" }}>
                          #{c?.nro ?? "-"}
                        </Link>
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>{formatDate(c?.vencimiento)}</td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>{formatMoney(c?.importe)}</td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>{formatMoney(c?.pagado)}</td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>
                        <span style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid #ddd", fontSize: 13 }}>
                          {est || "-"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>{pagoFecha}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div>No hay cuotas para esta venta.</div>
        )}
      </Card>
    </div>
  );
}
