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

export default function CuotaDetallePage() {
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/vicred/cuota/${id}`, { cache: "no-store" })
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

  const { cuota, venta, pagos } = data;

  const Card = ({ title, children }: any) => (
    <div style={{ marginTop: 16, padding: 18, border: "1px solid #e5e5e5", borderRadius: 14, background: "#fff" }}>
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
        <h1 style={{ margin: 0 }}>Detalle de Cuota</h1>
        <Link href="/vicred/panel" style={{ textDecoration: "none" }}>
          ← Volver al panel
        </Link>
      </div>

      <Card title={`Cuota #${cuota?.nro ?? "-"}`}>
        <Row label="Vence" value={formatDate(cuota?.vencimiento)} />
        <Row label="Importe" value={formatMoney(cuota?.importe)} />
        <Row label="Pagado" value={formatMoney(cuota?.pagado)} />
        <Row label="Estado" value={String(cuota?.estado ?? "-").toUpperCase()} />
      </Card>

      <Card title="Venta relacionada">
        <Row
          label="Factura"
          value={
            venta?.id ? (
              <Link href={`/vicred/venta/${venta.id}`} style={{ textDecoration: "none" }}>
                {venta?.factura_numero ?? "(sin número)"}
              </Link>
            ) : (
              "-"
            )
          }
        />
        <Row label="Fecha" value={formatDate(venta?.fecha)} />
        <Row label="Total" value={formatMoney(venta?.total)} />
        <Row label="Anticipo" value={formatMoney(venta?.anticipo)} />
      </Card>

      <Card title="Pagos aplicados a esta cuota">
        {Array.isArray(pagos) && pagos.length ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {pagos.map((p: any, idx: number) => (
              <li key={p?.id ?? idx}>
                Fecha: <b>{formatDate(p?.fecha)}</b> — Importe aplicado: <b>{formatMoney(p?.importe)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <div>No hay pagos registrados para esta cuota.</div>
        )}
      </Card>
    </div>
  );
}
