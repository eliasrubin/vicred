"use client";

import Link from "next/link";
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

function upper(x: any) {
  return String(x ?? "").toUpperCase();
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

  const cliente = data?.cliente ?? null;
  const estado = data?.estado ?? {};
  const cuotas = Array.isArray(data?.cuotas) ? data.cuotas : [];

  const cuotasPendientes = useMemo(() => {
    return cuotas.filter((c: any) => upper(c?.estado) !== "PAGADA");
  }, [cuotas]);

  const cuotasPagadas = useMemo(() => {
    return cuotas.filter((c: any) => upper(c?.estado) === "PAGADA");
  }, [cuotas]);

  if (error) return <div style={{ padding: 20 }}>Error: {error}</div>;
  if (!data) return <div style={{ padding: 20 }}>Cargando...</div>;
  if (!cliente) return <div style={{ padding: 20 }}>No autorizado</div>;

  // ==========================
  // ✅ WhatsApp (2 botones)
  // ==========================
  const WA_NUMBER = "542954222127";

  const clienteNombre = cliente?.nombre ?? "";
  const clienteDni = cliente?.dni ?? "-";
  const clienteVicred = cliente?.vicred_id ?? "-";

  const resumenBasico =
    `Hola, soy ${clienteNombre}.\n` +
    `DNI: ${clienteDni}\n` +
    `Nº Vicred: ${clienteVicred}`;

  const waMsgContacto =
    `Hola 👋\n` +
    `${resumenBasico}\n\n` +
    `Quisiera hacer una consulta sobre mi cuenta Vicred.`;

  const waMsgInformarPago =
    `Hola 👋\n` +
    `${resumenBasico}\n\n` +
    `Quiero INFORMAR un pago realizado.\n` +
    `✅ Monto: $____\n` +
    `📅 Fecha: __/__/____\n` +
    `💳 Método: EFECTIVO / TRANSFERENCIA\n` +
    `🧾 Referencia/Comprobante: ____\n\n` +
    `Adjunto comprobante si corresponde.`;

  const waLinkContacto = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMsgContacto)}`;
  const waLinkInformarPago = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMsgInformarPago)}`;

  const Card = ({ title, subtitle, children }: any) => (
    <div
      style={{
        marginTop: 16,
        padding: 18,
        border: "1px solid #e5e5e5",
        borderRadius: 14,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
        {subtitle ? <div style={{ color: "#666", fontSize: 13 }}>{subtitle}</div> : null}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );

  const Row = ({ label, value }: any) => (
    <div style={{ display: "flex", gap: 10, padding: "6px 0" }}>
      <div style={{ width: 170, color: "#555" }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value ?? "-"}</div>
    </div>
  );

  const FacturaLink = ({ cuota }: { cuota: any }) => {
    const ventaId = cuota?.venta?.id ?? cuota?.venta_id ?? null;
    const factura = cuota?.venta?.factura_numero ?? cuota?.factura_numero ?? null;

    if (!ventaId) return <span>-</span>;

    return (
      <Link href={`/vicred/venta/${ventaId}`} style={{ textDecoration: "none", fontWeight: 800 }}>
        {factura || "Ver venta"}
      </Link>
    );
  };

  const EstadoPill = ({ est }: { est: string }) => (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid #ddd",
        fontSize: 13,
        background: "#fff",
      }}
    >
      {est}
    </span>
  );

  const CuotaRow = ({ c, clickableCuota }: { c: any; clickableCuota: boolean }) => {
    const nro = c?.nro ?? c?.nro_cuota ?? "-";
    const venc = c?.vencimiento ?? c?.vencimiento_fecha ?? c?.fecha_vencimiento;
    const imp = c?.importe ?? c?.monto ?? 0;
    const est = upper(c?.estado || "PENDIENTE");
    const pagoFecha = c?.pago_fecha ? formatDate(c.pago_fecha) : "-";

    const cuotaCell = clickableCuota ? (
      <Link href={`/vicred/cuota/${c?.id}`} style={{ textDecoration: "none", fontWeight: 800 }}>
        #{nro}
      </Link>
    ) : (
      <span style={{ fontWeight: 800 }}>#{nro}</span>
    );

    return (
      <tr key={c?.id ?? `${nro}-${String(venc)}`}>
        <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>{cuotaCell}</td>
        <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>
          <FacturaLink cuota={c} />
        </td>
        <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>{formatDate(venc)}</td>
        <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>{formatMoney(imp)}</td>
        <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>
          <EstadoPill est={est} />
        </td>
        <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>{pagoFecha}</td>
      </tr>
    );
  };

  const Table = ({ rows, clickablePagadas }: { rows: any[]; clickablePagadas: boolean }) => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", color: "#666" }}>Cuota</th>
            <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", color: "#666" }}>Factura</th>
            <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", color: "#666" }}>Vence</th>
            <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", color: "#666" }}>Importe</th>
            <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", color: "#666" }}>Estado</th>
            <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", color: "#666" }}>Fecha de pago</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <CuotaRow key={c?.id} c={c} clickableCuota={clickablePagadas && upper(c?.estado) === "PAGADA"} />
          ))}
        </tbody>
      </table>
    </div>
  );

  // ==========================
  // ✅ Normalización del estado
  // ==========================
  const disponible = Number(estado?.disponible ?? estado?.available ?? 0) || 0;

  const limite =
    Number(estado?.limite ?? estado?.limite_total ?? estado?.limite_credito ?? estado?.credito_limite ?? 0) || 0;

  const totalPendiente =
    Number(estado?.total_pendiente ?? estado?.deuda_total ?? estado?.pendiente_total ?? estado?.totalPendiente ?? 0) || 0;

  const cuotasPendCount = estado?.cuotas_pendientes ?? estado?.cuotasPendientes ?? cuotasPendientes.length ?? 0;

  const usadoRaw = estado?.usado ?? estado?.saldo_utilizado ?? estado?.usado_total ?? estado?.deuda_total ?? null;

  const usado =
    usadoRaw != null ? Number(usadoRaw) || 0 : limite ? Math.max(0, limite - disponible) : totalPendiente;

  // ==========================
  // ✅ Próximo vencimiento
  // ==========================
  const vencStr = (v: any) => {
    if (!v) return null;
    return String(v).slice(0, 10);
  };

  const proximoVenc = (() => {
    const fechas = cuotasPendientes
      .map((c: any) => vencStr(c?.vencimiento ?? c?.vencimiento_fecha ?? c?.fecha_vencimiento))
      .filter(Boolean)
      .sort();
    return fechas[0] ?? null;
  })();

  const montoProximoVenc = (() => {
    if (!proximoVenc) return 0;

    return cuotasPendientes.reduce((acc: number, c: any) => {
      const fecha = vencStr(c?.vencimiento ?? c?.vencimiento_fecha ?? c?.fecha_vencimiento);
      if (fecha !== proximoVenc) return acc;

      const imp = Number(c?.importe ?? c?.monto ?? 0) || 0;
      const pag = Number(c?.pagado ?? 0) || 0;
      const pendiente = Math.max(0, imp - pag);

      return acc + pendiente;
    }, 0);
  })();

  return (
    <div style={{ maxWidth: 900, margin: "36px auto", padding: 16 }}>
      <h1 style={{ margin: 0 }}>VICRED — Portal Cliente</h1>
      <p style={{ marginTop: 8, color: "#666" }}>Acá podés ver tu estado, tus cuotas pendientes y tus cuotas pagadas.</p>

      <Card title="Cliente">
        <Row label="Nombre" value={cliente?.nombre || "-"} />
        <Row label="DNI" value={cliente?.dni || "-"} />
        <Row label="Nº Vicred" value={cliente?.vicred_id || "-"} />
      </Card>

      <Card title="Disponible para compras">
        <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.02em" }}>{formatMoney(disponible)}</div>

        {(limite !== 0 || usado !== 0) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
              <div style={{ color: "#666", fontSize: 13 }}>Límite</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{formatMoney(limite)}</div>
            </div>

            <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
              <div style={{ color: "#666", fontSize: 13 }}>Usado</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{formatMoney(usado)}</div>
            </div>
          </div>
        )}
      </Card>

      <Card title="Estado de tu crédito">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
            <div style={{ color: "#666", fontSize: 13 }}>Cuotas pendientes</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{cuotasPendCount}</div>
          </div>

          <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
            <div style={{ color: "#666", fontSize: 13 }}>Total pendiente</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{formatMoney(totalPendiente)}</div>
          </div>

          <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
            <div style={{ color: "#666", fontSize: 13 }}>Próximo vencimiento</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{proximoVenc ? formatDate(proximoVenc) : "-"}</div>
          </div>

          <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
            <div style={{ color: "#666", fontSize: 13 }}>Monto próximo venc.</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{formatMoney(montoProximoVenc)}</div>
          </div>
        </div>
      </Card>

      <Card title="Cuotas pendientes" subtitle={`${cuotasPendientes.length} cuotas`}>
        {cuotasPendientes.length ? <Table rows={cuotasPendientes} clickablePagadas={false} /> : <div>No tenés cuotas pendientes ✅</div>}
      </Card>

      <Card title="Cuotas pagadas" subtitle={`${cuotasPagadas.length} cuotas`}>
        {cuotasPagadas.length ? (
          <div style={{ marginBottom: 8 }}>
            <div style={{ color: "#666", fontSize: 13, marginBottom: 10 }}>
              Tip: hacé click en el <b>número de cuota</b> para ver el detalle del pago.
            </div>
            <Table rows={cuotasPagadas} clickablePagadas={true} />
          </div>
        ) : (
          <div>Todavía no hay cuotas pagadas.</div>
        )}
      </Card>

      {/* ✅ Botones WhatsApp (2 acciones) */}
      <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href={waLinkContacto} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
          <button
            style={{
              padding: "12px 16px",
              cursor: "pointer",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fff",
              fontWeight: 900,
            }}
          >
            💬 Contactar por WhatsApp
          </button>
        </a>

        <a href={waLinkInformarPago} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
          <button
            style={{
              padding: "12px 16px",
              cursor: "pointer",
              borderRadius: 12,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              fontWeight: 900,
            }}
          >
            ✅ Informar pago por WhatsApp
          </button>
        </a>
      </div>
    </div>
  );
}
