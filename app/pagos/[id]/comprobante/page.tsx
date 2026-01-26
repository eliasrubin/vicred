"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

type Pago = {
  id: string;
  created_at: string;
  cliente_id: string;
  venta_id: string | null;
  monto: number;
  metodo: string;
  referencia: string | null;
};

type Cliente = { id: string; nombre: string; dni: string | null; telefono: string | null };

type VentaSaldo = {
  id: string;
  fecha: string;
  factura_numero: string | null;
  total: number;
  comercio_codigo: string | null;
  comercio_nombre: string | null;
  saldo_pendiente: number;
};

type Aplicacion = { monto: number; cuota_id: string; nro: number; vencimiento: string; importe: number };

export default function ComprobantePagoPage() {
  const { id } = useParams<{ id: string }>(); // pagoId
  const router = useRouter();
  const sp = useSearchParams();

  const [pago, setPago] = useState<Pago | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [venta, setVenta] = useState<VentaSaldo | null>(null);
  const [apps, setApps] = useState<Aplicacion[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setErr(null);

      const { data: p, error: pErr } = await supabase
        .from("pagos")
        .select("id,created_at,cliente_id,venta_id,monto,metodo,referencia")
        .eq("id", id)
        .single();

      if (pErr) throw pErr;
      setPago(p as any);

      const { data: c, error: cErr } = await supabase
        .from("clientes")
        .select("id,nombre,dni,telefono")
        .eq("id", (p as any).cliente_id)
        .single();

      if (cErr) throw cErr;
      setCliente(c as any);

      if ((p as any).venta_id) {
        // usamos la vista para traer comercio + factura + saldo
        const { data: v, error: vErr } = await supabase
          .from("vw_ventas_saldo")
          .select("id,fecha,total,factura_numero,comercio_codigo,comercio_nombre,saldo_pendiente")
          .eq("id", (p as any).venta_id)
          .single();

        if (vErr) throw vErr;
        setVenta(v as any);
      } else {
        setVenta(null);
      }

      // Detalle aplicado (si existe pagos_aplicaciones)
      const { data: a, error: aErr } = await supabase
        .from("pagos_aplicaciones")
        .select("monto, cuota_id, cuotas!inner(nro,vencimiento,importe)")
        .eq("pago_id", id);

      // Si no existe o falla, no bloqueamos el comprobante
      if (!aErr && a) {
        const parsed = (a as any[]).map((x) => ({
          monto: Number(x.monto),
          cuota_id: x.cuota_id,
          nro: x.cuotas.nro,
          vencimiento: x.cuotas.vencimiento,
          importe: Number(x.cuotas.importe),
        }));
        setApps(parsed);
      } else {
        setApps([]);
      }

      // Si viene ?print=1, abre diálogo imprimir
      if (sp.get("print") === "1") {
        setTimeout(() => window.print(), 300);
      }
    })().catch((e) => setErr(e.message ?? String(e)));
  }, [id]);

  const fechaPago = useMemo(() => {
    if (!pago?.created_at) return "-";
    const d = new Date(pago.created_at);
    return d.toLocaleString("es-AR");
  }, [pago?.created_at]);

  const tituloComercio = useMemo(() => {
    if (!venta?.comercio_codigo) return "Créditos VI (PCGAME / VIMODA)";
    if (venta.comercio_codigo === "PCGAME") return "PCGAME · Comprobante de Pago";
    if (venta.comercio_codigo === "VIMODA") return "VIMODA · Comprobante de Pago";
    return `${venta.comercio_codigo} · Comprobante de Pago`;
  }, [venta?.comercio_codigo]);

  if (err) {
    return (
      <main style={{ maxWidth: 900, margin: "30px auto", fontFamily: "system-ui" }}>
        <button onClick={() => router.back()}>← Volver</button>
        <p style={{ color: "crimson", marginTop: 12 }}>{err}</p>
      </main>
    );
  }

  if (!pago || !cliente) {
    return (
      <main style={{ maxWidth: 900, margin: "30px auto", fontFamily: "system-ui" }}>
        <p>Cargando comprobante...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: "30px auto", fontFamily: "system-ui" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          main { margin: 0 !important; max-width: none !important; }
        }
      `}</style>

      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => router.back()}>← Volver</button>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        </div>
      </div>

      <div style={{ border: "1px solid #eaeaea", borderRadius: 14, padding: 18, marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>{tituloComercio}</h2>
            <p style={{ margin: "6px 0", opacity: 0.8 }}>Sistema interno de crédito</p>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>N° comprobante</div>
            <div style={{ fontWeight: 800 }}>{pago.id.slice(0, 8).toUpperCase()}</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Fecha</div>
            <div>{fechaPago}</div>
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "14px 0" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Cliente</div>
            <div style={{ fontWeight: 800 }}>{cliente.nombre}</div>
            <div style={{ opacity: 0.85 }}>DNI: {cliente.dni ?? "-"}</div>
            <div style={{ opacity: 0.85 }}>Tel: {cliente.telefono ?? "-"}</div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Pago</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>${Number(pago.monto).toFixed(2)}</div>
            <div style={{ opacity: 0.85 }}>Método: {pago.metodo}</div>
            <div style={{ opacity: 0.85 }}>Referencia: {pago.referencia ?? "-"}</div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Aplicado a</div>
          <div style={{ fontWeight: 700 }}>
            {pago.venta_id
              ? `${venta?.factura_numero ? `Factura ${venta.factura_numero}` : `Venta ${pago.venta_id.slice(0, 8)}`}${
                  venta?.comercio_codigo ? ` · ${venta.comercio_codigo}` : ""
                }`
              : "Pago general al cliente (FIFO)"}
          </div>

          {venta?.saldo_pendiente != null ? (
            <div style={{ marginTop: 6, opacity: 0.85 }}>
              Saldo pendiente de la factura (luego del pago): <b>${Number(venta.saldo_pendiente).toFixed(2)}</b>
            </div>
          ) : null}
        </div>

        {apps.length > 0 && (
          <>
            <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "14px 0" }} />
            <h3 style={{ margin: "0 0 8px 0" }}>Detalle aplicado a cuotas</h3>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Cuota</th>
                  <th style={th}>Vencimiento</th>
                  <th style={th}>Importe</th>
                  <th style={th}>Aplicado</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((x, i) => (
                  <tr key={i}>
                    <td style={td}>{x.nro}</td>
                    <td style={td}>{x.vencimiento}</td>
                    <td style={td}>${Number(x.importe).toFixed(2)}</td>
                    <td style={td}>
                      <b>${Number(x.monto).toFixed(2)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div style={{ marginTop: 18, fontSize: 12, opacity: 0.75 }}>
          Este comprobante es un registro interno de pago. Gracias.
        </div>
      </div>
    </main>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 10,
  borderBottom: "1px solid #ddd",
};
const td: React.CSSProperties = {
  padding: 10,
  borderBottom: "1px solid #f0f0f0",
};
