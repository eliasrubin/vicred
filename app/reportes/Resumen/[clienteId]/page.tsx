"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

type Cliente = { id: string; nombre: string; dni: string | null; telefono: string | null; direccion: string | null };

type CuotaRow = {
  id: string;
  nro: number;
  vencimiento: string;
  importe: number;
  pagado: number;
  estado: string;
  venta_id: string | null;
  ventas_credito?: {
    factura_numero: string | null;
    comercio_id: number;
    fecha: string;
  } | null;
};

function fmtMoney(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtFecha(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-AR");
  } catch {
    return iso;
  }
}

export default function ResumenClientePDF() {
  const router = useRouter();
  const { clienteId } = useParams<{ clienteId: string }>();
  const sp = useSearchParams();

  const desde = sp.get("desde") || "";
  const hasta = sp.get("hasta") || "";
  const autoPrint = sp.get("print") === "1";

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [rows, setRows] = useState<CuotaRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setErr(null);

    if (!clienteId) return;
    if (!desde || !hasta) {
      setErr("Falta rango (desde/hasta). Volvé y generá el resumen.");
      return;
    }

    const { data: c, error: cErr } = await supabase.from("clientes").select("id,nombre,dni,telefono,direccion").eq("id", clienteId).single();
    if (cErr) throw cErr;
    setCliente(c as any);

    const { data, error } = await supabase
      .from("cuotas")
      .select("id,nro,vencimiento,importe,pagado,estado,venta_id, ventas_credito(factura_numero,comercio_id,fecha)")
      .eq("cliente_id", clienteId)
      .gte("vencimiento", desde)
      .lte("vencimiento", hasta)
      .order("vencimiento", { ascending: true })
      .limit(5000);

    if (error) throw error;

    // solo pendientes por saldo real
    const pendientes = (data as any[] | null)?.filter((r) => Number(r.importe) - Number(r.pagado) > 0.0001) || [];
    setRows(pendientes as any);
  };

  useEffect(() => {
    load().catch((e) => setErr(e?.message ?? String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, desde, hasta]);

  useEffect(() => {
    if (!autoPrint) return;
    // esperar un toque a que renderice
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [autoPrint, rows.length]);

  const totales = useMemo(() => {
    let saldo = 0;
    for (const r of rows) saldo += Number(r.importe) - Number(r.pagado);
    return { cuotas: rows.length, saldo };
  }, [rows]);

  return (
    <main style={{ maxWidth: 900, margin: "20px auto", fontFamily: "system-ui" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => router.back()}>← Volver</button>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        </div>
      </div>

      {err && <p style={{ color: "crimson" }}>{err}</p>}

      <header style={{ border: "1px solid #eee", borderRadius: 12, padding: 14, marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Resumen de cuenta</div>
            <div style={{ opacity: 0.8 }}>Cuotas pendientes en el período seleccionado</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Emitido</div>
            <div style={{ fontWeight: 700 }}>{new Date().toLocaleString("es-AR")}</div>
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "12px 0" }} />

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Cliente</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{cliente?.nombre ?? "-"}</div>
            <div style={{ opacity: 0.85, fontSize: 12 }}>
              DNI: {cliente?.dni ?? "-"} · Tel: {cliente?.telefono ?? "-"} · Dir: {cliente?.direccion ?? "-"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Período</div>
            <div style={{ fontWeight: 700 }}>
              {fmtFecha(desde)} → {fmtFecha(hasta)}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Total pendiente</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>${fmtMoney(totales.saldo)}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Cuotas: {totales.cuotas}</div>
          </div>
        </div>
      </header>

      <section style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Vencimiento</th>
              <th style={th}>Factura</th>
              <th style={th}>Cuota</th>
              <th style={th}>Importe</th>
              <th style={th}>Pagado</th>
              <th style={th}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const saldo = Number(r.importe) - Number(r.pagado);
              const factura = r.ventas_credito?.factura_numero ?? (r.venta_id ? r.venta_id.slice(0, 8) : "-");
              return (
                <tr key={r.id}>
                  <td style={td}>{fmtFecha(r.vencimiento)}</td>
                  <td style={td}>{factura}</td>
                  <td style={td}>{r.nro}</td>
                  <td style={td}>${fmtMoney(Number(r.importe))}</td>
                  <td style={td}>${fmtMoney(Number(r.pagado))}</td>
                  <td style={td}>
                    <b>${fmtMoney(saldo)}</b>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td style={td} colSpan={6}>
                  (No hay cuotas pendientes en este período)
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ marginTop: 14, opacity: 0.75, fontSize: 12 }}>
          Este resumen es informativo. Si el cliente solicita comprobante oficial, se emite por los medios habituales del comercio.
        </div>
      </section>
    </main>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: 10, borderBottom: "1px solid #ddd", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: 10, borderBottom: "1px solid #f3f3f3", verticalAlign: "top" };
