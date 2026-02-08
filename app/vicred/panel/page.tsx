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

function ymd(x: any) {
  if (!x) return null;
  return String(x).slice(0, 10);
}

function parseYmdToDate(x: string | null) {
  if (!x) return null;
  const [y, m, d] = x.split("-").map((v) => Number(v));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function diffDays(a: Date, b: Date) {
  // a - b in days
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
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

  const cuotasPendientes = useMemo(() => cuotas.filter((c: any) => upper(c?.estado) !== "PAGADA"), [cuotas]);
  const cuotasPagadas = useMemo(() => cuotas.filter((c: any) => upper(c?.estado) === "PAGADA"), [cuotas]);

  if (error) return <div style={{ padding: 20 }}>Error: {error}</div>;
  if (!data) return <div style={{ padding: 20 }}>Cargando...</div>;
  if (!cliente) return <div style={{ padding: 20 }}>No autorizado</div>;

  // ==========================
  // ✅ Normalización estado (soporta distintas columnas)
  // ==========================
  const disponible = Number(estado?.disponible ?? estado?.available ?? 0) || 0;

  const limite =
    Number(estado?.limite ?? estado?.limite_total ?? estado?.limite_credito ?? estado?.credito_limite ?? 0) || 0;

  const totalPendiente =
    Number(estado?.total_pendiente ?? estado?.deuda_total ?? estado?.pendiente_total ?? estado?.totalPendiente ?? 0) || 0;

  const cuotasPendCount = estado?.cuotas_pendientes ?? estado?.cuotasPendientes ?? cuotasPendientes.length ?? 0;

  const usadoRaw = estado?.usado ?? estado?.saldo_utilizado ?? estado?.usado_total ?? estado?.deuda_total ?? null;

  const usado = usadoRaw != null ? Number(usadoRaw) || 0 : limite ? Math.max(0, limite - disponible) : totalPendiente;

  // ==========================
  // ✅ Próximo vencimiento real + monto de ese vencimiento
  // ==========================
  const proximoVenc = (() => {
    const fechas = cuotasPendientes
      .map((c: any) => ymd(c?.vencimiento ?? c?.vencimiento_fecha ?? c?.fecha_vencimiento))
      .filter(Boolean)
      .sort();
    return (fechas[0] as string) ?? null;
  })();

  const montoProximoVenc = (() => {
    if (!proximoVenc) return 0;
    return cuotasPendientes.reduce((acc: number, c: any) => {
      const fecha = ymd(c?.vencimiento ?? c?.vencimiento_fecha ?? c?.fecha_vencimiento);
      if (fecha !== proximoVenc) return acc;
      const imp = Number(c?.importe ?? c?.monto ?? 0) || 0;
      const pag = Number(c?.pagado ?? 0) || 0;
      return acc + Math.max(0, imp - pag);
    }, 0);
  })();

  // ==========================
  // ✅ WhatsApp (2 botones) + datos bancarios
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
    `Hola 👋\n` + `${resumenBasico}\n\n` + `Quisiera hacer una consulta sobre mi cuenta Vicred.`;

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

  const BANK = {
    alias: "vicred",
    cbu: "0930322320100274643261",
    titular: "Maldonado Florencia Noely",
    banco: "Banco de la Pampa",
  };

  // ==========================
  // UI Components
  // ==========================
  const Shell = ({ children }: any) => (
    <div style={styles.shell}>
      <div style={styles.topbar}>
        <div>
          <div style={styles.brand}>VICRED</div>
          <div style={styles.slogan}>Tu crédito, claro y simple</div>
        </div>

        <div style={styles.topRight}>
          <div style={styles.smallMuted}>Portal Cliente</div>
          <div style={styles.smallStrong}>Nº {clienteVicred}</div>
        </div>
      </div>

      <div style={styles.container}>{children}</div>

      <div style={styles.footer}>
        <div style={{ opacity: 0.8 }}>
          Si ya pagaste, usá <b>“Informar pago”</b> y adjuntá el comprobante.
        </div>
      </div>
    </div>
  );

  const Card = ({ title, subtitle, children }: any) => (
    <section style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <div style={styles.cardTitle}>{title}</div>
          {subtitle ? <div style={styles.cardSubtitle}>{subtitle}</div> : null}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );

  const Stat = ({ label, value, hint }: { label: string; value: any; hint?: any }) => (
    <div style={styles.stat}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
      {hint ? <div style={styles.statHint}>{hint}</div> : null}
    </div>
  );

  const Pill = ({ text, variant }: { text: string; variant: "ok" | "warn" | "bad" | "neutral" }) => {
    const s =
      variant === "ok"
        ? styles.pillOk
        : variant === "warn"
        ? styles.pillWarn
        : variant === "bad"
        ? styles.pillBad
        : styles.pillNeutral;

    return <span style={{ ...styles.pill, ...s }}>{text}</span>;
  };

  const FacturaLink = ({ cuota }: { cuota: any }) => {
    const ventaId = cuota?.venta?.id ?? cuota?.venta_id ?? null;
    const factura = cuota?.venta?.factura_numero ?? cuota?.factura_numero ?? null;
    if (!ventaId) return <span style={{ color: "#9ca3af" }}>-</span>;

    return (
      <Link href={`/vicred/venta/${ventaId}`} style={styles.linkStrong}>
        {factura || "Ver venta"}
      </Link>
    );
  };

  const cuotaBadge = (c: any) => {
    const venc = ymd(c?.vencimiento ?? c?.vencimiento_fecha ?? c?.fecha_vencimiento);
    const dV = parseYmdToDate(venc);
    if (!dV) return <Pill text="Sin fecha" variant="neutral" />;

    const hoy = new Date();
    const days = diffDays(dV, hoy); // >0 futuro, 0 hoy, <0 vencida

    if (days < 0) return <Pill text="Vencida" variant="bad" />;
    if (days === 0) return <Pill text="Vence hoy" variant="warn" />;
    if (days <= 7) return <Pill text="Próxima" variant="warn" />;
    return <Pill text="En término" variant="ok" />;
  };

  const Table = ({ rows, clickablePagadas }: { rows: any[]; clickablePagadas: boolean }) => (
    <div style={{ overflowX: "auto" }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Cuota</th>
            <th style={styles.th}>Factura</th>
            <th style={styles.th}>Vence</th>
            <th style={styles.th}>Importe</th>
            <th style={styles.th}>Estado</th>
            <th style={styles.th}>Pago</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((c) => {
            const nro = c?.nro ?? c?.nro_cuota ?? "-";
            const venc = c?.vencimiento ?? c?.vencimiento_fecha ?? c?.fecha_vencimiento;
            const imp = c?.importe ?? c?.monto ?? 0;
            const est = upper(c?.estado || "PENDIENTE");
            const pagoFecha = c?.pago_fecha ? formatDate(c.pago_fecha) : "-";

            const cuotaCell =
              clickablePagadas && est === "PAGADA" ? (
                <Link href={`/vicred/cuota/${c?.id}`} style={styles.linkStrong}>
                  #{nro}
                </Link>
              ) : (
                <span style={{ fontWeight: 900 }}>#{nro}</span>
              );

            return (
              <tr key={c?.id ?? `${nro}-${String(venc)}`}>
                <td style={styles.td}>{cuotaCell}</td>
                <td style={styles.td}>
                  <FacturaLink cuota={c} />
                </td>
                <td style={styles.td}>
                  <div style={{ fontWeight: 800 }}>{formatDate(venc)}</div>
                  <div style={{ marginTop: 6 }}>{cuotaBadge(c)}</div>
                </td>
                <td style={styles.td}>{formatMoney(imp)}</td>
                <td style={styles.td}>
                  <Pill text={est} variant={est === "PAGADA" ? "ok" : "neutral"} />
                </td>
                <td style={styles.td}>{pagoFecha}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <Shell>
      {/* HERO / Disponible */}
      <section style={styles.hero}>
        <div style={styles.heroCard}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={styles.heroLabel}>Disponible para compras</div>
              <div style={{ ...styles.heroValue, color: disponible > 0 ? "#111" : "#6b7280" }}>{formatMoney(disponible)}</div>
              <div style={styles.heroHint}>
                Límite: <b>{formatMoney(limite)}</b> · Usado: <b>{formatMoney(usado)}</b>
              </div>
            </div>

            <div style={styles.heroMiniGrid}>
              <Stat label="Cuotas pendientes" value={String(cuotasPendCount)} />
              <Stat label="Total pendiente" value={formatMoney(totalPendiente)} />
              <Stat label="Próximo venc." value={proximoVenc ? formatDate(proximoVenc) : "-"} />
              <Stat label="Monto prox. venc." value={formatMoney(montoProximoVenc)} />
            </div>
          </div>
        </div>
      </section>

      {/* Cliente + Pagos/Contacto */}
      <div style={styles.twoCol}>
        <Card title="Tus datos">
          <div style={styles.rows}>
            <div style={styles.row}>
              <div style={styles.rowLabel}>Nombre</div>
              <div style={styles.rowValue}>{cliente?.nombre || "-"}</div>
            </div>
            <div style={styles.row}>
              <div style={styles.rowLabel}>DNI</div>
              <div style={styles.rowValue}>{cliente?.dni || "-"}</div>
            </div>
            <div style={styles.row}>
              <div style={styles.rowLabel}>Nº Vicred</div>
              <div style={styles.rowValue}>{cliente?.vicred_id || "-"}</div>
            </div>
          </div>
        </Card>

        <Card title="Pagos y contacto" subtitle="Transferencias y WhatsApp">
          <div style={styles.bankBox}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Datos para transferir</div>

            <div style={styles.bankRow}>
              <div style={styles.bankK}>Alias</div>
              <div style={styles.bankV}>{BANK.alias}</div>
            </div>
            <div style={styles.bankRow}>
              <div style={styles.bankK}>CBU</div>
              <div style={styles.bankV} title={BANK.cbu}>
                {BANK.cbu}
              </div>
            </div>
            <div style={styles.bankRow}>
              <div style={styles.bankK}>Titular</div>
              <div style={styles.bankV}>{BANK.titular}</div>
            </div>
            <div style={styles.bankRow}>
              <div style={styles.bankK}>Banco</div>
              <div style={styles.bankV}>{BANK.banco}</div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
              Tip: si transferiste, apretá <b>“Informar pago”</b> y adjuntá el comprobante.
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <a href={waLinkContacto} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              <button style={styles.btnGhost}>💬 Contactar por WhatsApp</button>
            </a>

            <a href={waLinkInformarPago} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              <button style={styles.btnPrimary}>✅ Informar pago</button>
            </a>
          </div>
        </Card>
      </div>

      {/* Cuotas pendientes */}
      <Card title="Cuotas pendientes" subtitle={`${cuotasPendientes.length} cuotas`}>
        {cuotasPendientes.length ? <Table rows={cuotasPendientes} clickablePagadas={false} /> : <div>No tenés cuotas pendientes ✅</div>}
      </Card>

      {/* Cuotas pagadas */}
      <Card title="Cuotas pagadas" subtitle={`${cuotasPagadas.length} cuotas`}>
        {cuotasPagadas.length ? (
          <div>
            <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 10 }}>
              Tip: hacé click en el <b>número de cuota</b> para ver el detalle del pago.
            </div>
            <Table rows={cuotasPagadas} clickablePagadas={true} />
          </div>
        ) : (
          <div>Todavía no hay cuotas pagadas.</div>
        )}
      </Card>
    </Shell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    background: "#f6f7f9",
  },
  topbar: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    background: "rgba(246,247,249,0.92)",
    backdropFilter: "blur(8px)",
    borderBottom: "1px solid #e7e7ea",
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  brand: {
    fontWeight: 950,
    letterSpacing: "-0.03em",
    fontSize: 20,
    color: "#111",
  },
  slogan: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  topRight: {
    textAlign: "right",
    minWidth: 160,
  },
  smallMuted: { fontSize: 12, color: "#6b7280" },
  smallStrong: { fontSize: 13, fontWeight: 900, color: "#111" },
  container: {
    maxWidth: 980,
    margin: "0 auto",
    padding: "16px 16px 28px",
  },
  footer: {
    padding: "16px 16px 26px",
    textAlign: "center",
    color: "#6b7280",
    fontSize: 12,
  },
  hero: {
    marginTop: 8,
  },
  heroCard: {
    border: "1px solid #e7e7ea",
    background: "#fff",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 16px 35px rgba(0,0,0,0.06)",
  },
  heroLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 700,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
  },
  heroValue: {
    marginTop: 6,
    fontSize: 44,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  heroHint: {
    marginTop: 8,
    fontSize: 13,
    color: "#6b7280",
  },
  heroMiniGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    minWidth: 320,
    flex: "0 0 auto",
    alignContent: "start",
  },
  stat: {
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 12,
    background: "#fbfbfc",
  },
  statLabel: { fontSize: 12, color: "#6b7280" },
  statValue: { marginTop: 6, fontSize: 18, fontWeight: 950, color: "#111" },
  statHint: { marginTop: 4, fontSize: 12, color: "#6b7280" },

  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    marginTop: 14,
  },

  card: {
    marginTop: 14,
    padding: 16,
    border: "1px solid #e7e7ea",
    borderRadius: 18,
    background: "#fff",
    boxShadow: "0 10px 26px rgba(0,0,0,0.05)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "baseline",
    flexWrap: "wrap",
  },
  cardTitle: { fontSize: 16, fontWeight: 950, color: "#111" },
  cardSubtitle: { fontSize: 13, color: "#6b7280" },

  rows: { display: "grid", gap: 8 },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #eee",
    background: "#fbfbfc",
  },
  rowLabel: { color: "#6b7280", fontSize: 13 },
  rowValue: { fontWeight: 900, color: "#111" },

  bankBox: {
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 12,
    background: "#fbfbfc",
  },
  bankRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 0",
    borderBottom: "1px dashed #e5e7eb",
  },
  bankK: { fontSize: 13, color: "#6b7280" },
  bankV: { fontSize: 13, fontWeight: 900, color: "#111", wordBreak: "break-all" },

  btnGhost: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  },
  btnPrimary: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 760,
  },
  th: {
    textAlign: "left",
    padding: "10px 10px",
    borderBottom: "1px solid #eee",
    color: "#6b7280",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px 10px",
    borderBottom: "1px solid #f1f2f4",
    verticalAlign: "top",
    fontSize: 14,
  },

  linkStrong: {
    textDecoration: "none",
    fontWeight: 950,
    color: "#111",
  },

  pill: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid #e5e7eb",
    background: "#fff",
  },
  pillOk: { borderColor: "#c7f2d3", background: "#f1fff5", color: "#166534" },
  pillWarn: { borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" },
  pillBad: { borderColor: "#fecaca", background: "#fff1f2", color: "#991b1b" },
  pillNeutral: { borderColor: "#e5e7eb", background: "#fff", color: "#111827" },
};

// Mobile tweak
// (inline: lo resolvemos con CSS grid simple, Next no permite media queries inline;
// si querés, lo pasamos a globals.css con 6 líneas)
