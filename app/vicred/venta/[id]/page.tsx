"use client";

import { useEffect, useMemo, useState } from "react";
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

function upper(x: any) {
  return String(x ?? "").toUpperCase();
}

function dateStr(d: any) {
  if (!d) return null;
  return String(d).slice(0, 10);
}

export default function VentaDetallePage() {
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

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

  const { venta, cuotas } = data || {};
  const rows: any[] = Array.isArray(cuotas) ? cuotas : [];

  const factura = venta?.factura_numero ?? "—";
  const fechaCompra = venta?.fecha ?? null;
  const total = Number(venta?.total ?? 0) || 0;
  const anticipo = Number(venta?.anticipo ?? 0) || 0;
  const cantCuotas = Number(venta?.cuotas_cantidad ?? venta?.cuotas ?? 0) || 0;

  const totalCuotas = useMemo(() => {
    return rows.reduce((acc, c) => acc + (Number(c?.importe ?? 0) || 0), 0);
  }, [rows]);

  const totalPagado = useMemo(() => {
    return rows.reduce((acc, c) => acc + (Number(c?.pagado ?? 0) || 0), 0);
  }, [rows]);

  const saldoCuotas = useMemo(() => {
    // saldo de cuotas = suma(importe - pagado) de todas las cuotas
    return rows.reduce((acc, c) => {
      const imp = Number(c?.importe ?? 0) || 0;
      const pag = Number(c?.pagado ?? 0) || 0;
      return acc + Math.max(0, imp - pag);
    }, 0);
  }, [rows]);

  const cuotasPendientes = useMemo(() => {
    return rows.filter((c) => upper(c?.estado) !== "PAGADA");
  }, [rows]);

  const cuotasPagadas = useMemo(() => {
    return rows.filter((c) => upper(c?.estado) === "PAGADA");
  }, [rows]);

  const proximoVenc = useMemo(() => {
    const fechas = cuotasPendientes
      .map((c: any) => dateStr(c?.vencimiento ?? c?.vencimiento_fecha ?? c?.fecha_vencimiento))
      .filter(Boolean)
      .sort();
    return fechas[0] ?? null;
  }, [cuotasPendientes]);

  const montoProximoVenc = useMemo(() => {
    if (!proximoVenc) return 0;
    return cuotasPendientes.reduce((acc: number, c: any) => {
      const f = dateStr(c?.vencimiento ?? c?.vencimiento_fecha ?? c?.fecha_vencimiento);
      if (f !== proximoVenc) return acc;
      const imp = Number(c?.importe ?? 0) || 0;
      const pag = Number(c?.pagado ?? 0) || 0;
      return acc + Math.max(0, imp - pag);
    }, 0);
  }, [cuotasPendientes, proximoVenc]);

  const Header = () => (
    <div style={styles.header}>
      <div>
        <div style={styles.brand}>VICRED</div>
        <div style={styles.title}>Detalle de venta</div>
        <div style={styles.sub}>
          Factura <b>{factura}</b> · Compra {fechaCompra ? formatDate(fechaCompra) : "-"}
        </div>
      </div>

      <div style={styles.headerActions}>
        <Link href="/vicred/panel" style={{ ...styles.btn, textDecoration: "none" }}>
          ← Volver
        </Link>
      </div>
    </div>
  );

  const Card = ({ title, subtitle, children }: any) => (
    <section style={styles.card}>
      <div style={styles.cardHead}>
        <div style={styles.cardTitle}>{title}</div>
        {subtitle ? <div style={styles.cardSub}>{subtitle}</div> : null}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </section>
  );

  const Pill = ({ text, kind = "neutral" }: { text: string; kind?: "neutral" | "ok" | "warn" }) => {
    const s =
      kind === "ok"
        ? { borderColor: "#bfe8c7", background: "#f3fff5", color: "#1b6b2a" }
        : kind === "warn"
        ? { borderColor: "#ffe0b5", background: "#fff8ee", color: "#8a4b00" }
        : { borderColor: "#e5e5e5", background: "#fff", color: "#222" };

    return (
      <span style={{ ...styles.pill, ...s }}>
        {text}
      </span>
    );
  };

  const Row = ({ label, value }: any) => (
    <div style={styles.row}>
      <div style={styles.rowLabel}>{label}</div>
      <div style={styles.rowValue}>{value ?? "-"}</div>
    </div>
  );

  return (
    <main style={styles.page}>
      <Header />

      {/* KPIs */}
      <section style={styles.kpiGrid}>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Total compra</div>
          <div style={styles.kpiValue}>{formatMoney(total)}</div>
        </div>

        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Anticipo</div>
          <div style={styles.kpiValue}>{formatMoney(anticipo)}</div>
        </div>

        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Saldo cuotas</div>
          <div style={styles.kpiValue}>{formatMoney(saldoCuotas)}</div>
          <div style={styles.kpiHint}>
            {cuotasPendientes.length ? (
              <span>
                Próx. venc.: <b>{proximoVenc ? formatDate(proximoVenc) : "-"}</b> ·{" "}
                <b>{formatMoney(montoProximoVenc)}</b>
              </span>
            ) : (
              <span>Sin cuotas pendientes ✅</span>
            )}
          </div>
        </div>

        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Cuotas</div>
          <div style={styles.kpiValue}>
            {cuotasPagadas.length}/{cantCuotas || rows.length || 0}
          </div>
          <div style={styles.kpiHint}>
            {cuotasPendientes.length ? (
              <span>Pendientes: <b>{cuotasPendientes.length}</b></span>
            ) : (
              <span>Todo pagado ✅</span>
            )}
          </div>
        </div>
      </section>

      <Card
        title="Datos de la venta"
        subtitle={venta?.observacion ? "Incluye observación" : ""}
      >
        <div style={styles.twoCol}>
          <div>
            <Row label="Factura" value={factura} />
            <Row label="Fecha de compra" value={fechaCompra ? formatDate(fechaCompra) : "-"} />
            <Row label="Cantidad de cuotas" value={cantCuotas || rows.length || "-"} />
          </div>

          <div>
            <Row label="Total cuotas" value={formatMoney(totalCuotas)} />
            <Row label="Total pagado" value={formatMoney(totalPagado)} />
            <Row label="Comercio" value={venta?.comercio_id ?? "-"} />
          </div>
        </div>

        {venta?.observacion ? (
          <div style={{ marginTop: 12, ...styles.note }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Observación</div>
            <div style={{ opacity: 0.85 }}>{String(venta.observacion)}</div>
          </div>
        ) : null}
      </Card>

      <Card
        title="Cuotas de esta venta"
        subtitle={`${rows.length} cuotas · ${cuotasPendientes.length} pendientes`}
      >
        {rows.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Cuota</th>
                  <th style={styles.th}>Vence</th>
                  <th style={styles.th}>Importe</th>
                  <th style={styles.th}>Pagado</th>
                  <th style={styles.th}>Saldo</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Pago</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c: any) => {
                  const est = upper(c?.estado || "PENDIENTE");
                  const pagoFecha = c?.pago_fecha ? formatDate(c.pago_fecha) : "-";
                  const imp = Number(c?.importe ?? 0) || 0;
                  const pag = Number(c?.pagado ?? 0) || 0;
                  const saldo = Math.max(0, imp - pag);

                  const pillKind =
                    est === "PAGADA" ? "ok" : saldo > 0 ? "warn" : "neutral";

                  return (
                    <tr key={c?.id ?? `${c?.nro}-${String(c?.vencimiento)}`}>
                      <td style={styles.tdStrong}>
                        <Link href={`/vicred/cuota/${c.id}`} style={styles.linkStrong}>
                          #{c?.nro ?? "-"}
                        </Link>
                      </td>
                      <td style={styles.td}>{formatDate(c?.vencimiento)}</td>
                      <td style={styles.td}>{formatMoney(imp)}</td>
                      <td style={styles.td}>{formatMoney(pag)}</td>
                      <td style={styles.td}>
                        <b>{formatMoney(saldo)}</b>
                      </td>
                      <td style={styles.td}>
                        <Pill text={est} kind={pillKind as any} />
                      </td>
                      <td style={styles.td}>{pagoFecha}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ opacity: 0.8 }}>No hay cuotas para esta venta.</div>
        )}
      </Card>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 950,
    margin: "28px auto",
    padding: "0 14px 28px",
    fontFamily: "system-ui",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 14,
  },

  brand: { fontWeight: 900, letterSpacing: 1, opacity: 0.85 },
  title: { fontSize: 26, fontWeight: 950, marginTop: 4 },
  sub: { marginTop: 6, opacity: 0.7, fontSize: 13 },

  headerActions: { display: "flex", gap: 10 },
  btn: {
    padding: "10px 12px",
    border: "1px solid #ddd",
    borderRadius: 12,
    background: "white",
    color: "#111",
    fontWeight: 800,
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginTop: 10,
  },

  kpi: {
    border: "1px solid #eee",
    borderRadius: 16,
    padding: 14,
    background: "#fff",
  },

  kpiLabel: { fontSize: 12, opacity: 0.7 },
  kpiValue: { fontSize: 22, fontWeight: 950, marginTop: 6 },
  kpiHint: { marginTop: 8, fontSize: 12, opacity: 0.75, lineHeight: 1.35 },

  card: {
    marginTop: 14,
    padding: 16,
    border: "1px solid #eee",
    borderRadius: 16,
    background: "#fff",
  },

  cardHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 10,
    flexWrap: "wrap",
  },

  cardTitle: { fontSize: 16, fontWeight: 900 },
  cardSub: { fontSize: 13, opacity: 0.65 },

  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },

  row: { display: "flex", gap: 10, padding: "7px 0" },
  rowLabel: { width: 170, opacity: 0.75 },
  rowValue: { fontWeight: 900 },

  note: {
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 14,
    background: "#fafafa",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 6,
  },

  th: {
    textAlign: "left",
    padding: "10px 8px",
    borderBottom: "1px solid #eee",
    color: "#666",
    whiteSpace: "nowrap",
    fontSize: 13,
  },

  td: {
    padding: "10px 8px",
    borderBottom: "1px solid #f2f2f2",
    verticalAlign: "top",
    fontSize: 14,
  },

  tdStrong: {
    padding: "10px 8px",
    borderBottom: "1px solid #f2f2f2",
    verticalAlign: "top",
    fontWeight: 900,
    fontSize: 14,
    whiteSpace: "nowrap",
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
    border: "1px solid #e5e5e5",
    fontSize: 12,
    fontWeight: 900,
  },
};
