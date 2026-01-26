"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

type PagoRow = {
  id: string;
  created_at: string;
  cliente_id: string;
  monto: number;
  metodo: string;
  referencia: string | null;
  venta_id: string | null;

  anulada: boolean;
  anulada_at: string | null;
  anulada_motivo: string | null;

  // join clientes
  clientes?: {
    nombre: string;
    dni: string | null;
    telefono: string | null;
  } | null;

  // join ventas (para factura)
  ventas_credito?: {
    factura_numero: string | null;
  } | null;
};

export default function HistorialCobranzasPage() {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PagoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pagos")
        .select(
          "id,created_at,cliente_id,monto,metodo,referencia,venta_id,anulada,anulada_at,anulada_motivo, clientes(nombre,dni,telefono), ventas_credito(factura_numero)"
        )
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setRows((data as any) || []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const anular = async (pagoId: string) => {
    const motivo = prompt("Motivo de anulación (opcional):", "Monto cargado incorrecto");
    if (motivo === null) return; // canceló

    if (!confirm("¿Confirmás ANULAR este pago? Se revertirá automáticamente de las cuotas.")) return;

    setErr(null);
    setLoading(true);
    try {
      const { error } = await supabase.rpc("anular_pago", {
        p_pago_id: pagoId,
        p_motivo: motivo,
      });

      if (error) throw error;

      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((r) => {
      const nombre = (r.clientes?.nombre ?? "").toLowerCase();
      const dni = (r.clientes?.dni ?? "").toLowerCase();
      const tel = (r.clientes?.telefono ?? "").toLowerCase();
      const comp = (r.id ?? "").toLowerCase();
      const compCorto = (r.id ?? "").slice(0, 8).toLowerCase();
      const factura = (r.ventas_credito?.factura_numero ?? "").toLowerCase();
      const ref = (r.referencia ?? "").toLowerCase();
      const metodo = (r.metodo ?? "").toLowerCase();
      const anuladaTxt = r.anulada ? "anulado" : "";
      const motivo = (r.anulada_motivo ?? "").toLowerCase();

      return (
        nombre.includes(s) ||
        dni.includes(s) ||
        tel.includes(s) ||
        comp.includes(s) ||
        compCorto.includes(s) ||
        factura.includes(s) ||
        ref.includes(s) ||
        metodo.includes(s) ||
        anuladaTxt.includes(s) ||
        motivo.includes(s)
      );
    });
  }, [q, rows]);

  return (
    <main style={{ maxWidth: 1100, margin: "30px auto", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => router.back()}>← Volver</button>
          <h2 style={{ margin: 0 }}>Historial de cobranzas</h2>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/pagos/nuevo" style={btnLink}>
            + Registrar pago
          </Link>
          <button onClick={load} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>

      {err && <p style={{ color: "crimson" }}>{err}</p>}

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 220px", gap: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por cliente, DNI, teléfono, comprobante, factura, referencia, anulado..."
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
        />

        <button
          onClick={() => setQ("")}
          style={{ padding: 12 }}
          disabled={loading}
        >
          Limpiar
        </button>
      </div>

      <div style={{ marginTop: 14, opacity: 0.8 }}>
        Mostrando <b>{filtrados.length}</b> de <b>{rows.length}</b> cobranzas (últimas 200).
      </div>

      <section style={card}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Fecha</th>
              <th style={th}>Cliente</th>
              <th style={th}>Factura</th>
              <th style={th}>Método</th>
              <th style={th}>Monto</th>
              <th style={th}>Comprobante</th>
              <th style={th}>Estado</th>
              <th style={th}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((r) => (
              <tr key={r.id} style={r.anulada ? { opacity: 0.65 } : undefined}>
                <td style={td}>{formatFecha(r.created_at)}</td>
                <td style={td}>
                  <div style={{ fontWeight: 700 }}>{r.clientes?.nombre ?? "-"}</div>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>
                    DNI: {r.clientes?.dni ?? "-"} · Tel: {r.clientes?.telefono ?? "-"}
                  </div>
                </td>
                <td style={td}>{r.ventas_credito?.factura_numero ?? (r.venta_id ? r.venta_id.slice(0, 8) : "-")}</td>
                <td style={td}>
                  <div>{r.metodo}</div>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>Ref: {r.referencia ?? "-"}</div>
                </td>
                <td style={td}>
                  <b>${Number(r.monto).toFixed(2)}</b>
                </td>
                <td style={td}>{r.id.slice(0, 8).toUpperCase()}</td>

                <td style={td}>
                  {!r.anulada ? (
                    <span style={{ fontSize: 12, padding: "4px 8px", border: "1px solid #ddd", borderRadius: 999 }}>OK</span>
                  ) : (
                    <div>
                      <span style={{ fontSize: 12, padding: "4px 8px", border: "1px solid #ddd", borderRadius: 999 }}>
                        ANULADO
                      </span>
                      <div style={{ fontSize: 12, marginTop: 6, opacity: 0.9 }}>
                        {r.anulada_at ? formatFecha(r.anulada_at) : ""}
                        {r.anulada_motivo ? ` · ${r.anulada_motivo}` : ""}
                      </div>
                    </div>
                  )}
                </td>

                <td style={td}>
                  <Link href={`/pagos/${r.id}/comprobante`} style={btnLinkInline}>
                    Ver / Imprimir
                  </Link>
                  <Link href={`/pagos/${r.id}/comprobante?print=1`} style={btnLinkInline}>
                    PDF
                  </Link>

                  {!r.anulada ? (
                    <button
                      onClick={() => anular(r.id)}
                      style={{ ...btnBtnInline, marginLeft: 6 }}
                      disabled={loading}
                      title="Anular pago (revierte cuotas)"
                    >
                      Anular
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}

            {filtrados.length === 0 && (
              <tr>
                <td style={td} colSpan={8}>
                  (No hay resultados con ese filtro)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function formatFecha(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-AR");
  } catch {
    return iso;
  }
}

const card: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  border: "1px solid #eee",
  borderRadius: 12,
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 10,
  borderBottom: "1px solid #ddd",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: 10,
  borderBottom: "1px solid #f0f0f0",
  verticalAlign: "top",
};

const btnLink: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #ddd",
  borderRadius: 8,
  textDecoration: "none",
};

const btnLinkInline: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #ddd",
  borderRadius: 8,
  textDecoration: "none",
  display: "inline-block",
  marginRight: 6,
};

const btnBtnInline: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #ddd",
  borderRadius: 8,
  background: "white",
  cursor: "pointer",
  display: "inline-block",
};

