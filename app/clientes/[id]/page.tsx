"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

type VentaSaldo = {
  id: string;
  cliente_id: string;
  fecha: string;
  factura_numero: string | null;
  total: number;
  comercio_id: number;
  comercio_nombre: string;
  comercio_codigo: string;
  saldo_pendiente: number;
};

export default function ClienteDetalle() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [cliente, setCliente] = useState<any>(null);
  const [estado, setEstado] = useState<any>(null);

  const [ventas, setVentas] = useState<VentaSaldo[]>([]);
  const [cuotas, setCuotas] = useState<any[]>([]);

  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setErr(null);

    const { data: c, error: cErr } = await supabase.from("clientes").select("*").eq("id", id).single();
    if (cErr) throw cErr;
    setCliente(c);

    const { data: e, error: eErr } = await supabase.from("vw_estado_credito").select("*").eq("cliente_id", id).single();
    if (eErr) throw eErr;
    setEstado(e);

    const { data: v, error: vErr } = await supabase
      .from("vw_ventas_saldo")
      .select("id,cliente_id,fecha,total,factura_numero,comercio_id,comercio_nombre,comercio_codigo,saldo_pendiente")
      .eq("cliente_id", id)
      .order("fecha", { ascending: false });

    if (vErr) throw vErr;
    setVentas(v as any);

    const { data: q, error: qErr } = await supabase
      .from("cuotas")
      .select("id,nro,vencimiento,importe,pagado,estado,venta_id")
      .eq("cliente_id", id)
      .order("vencimiento", { ascending: true });

    if (qErr) throw qErr;
    setCuotas(q as any);
  };

  useEffect(() => {
    if (!id) return;
    load().catch((e) => setErr(e.message ?? String(e)));
  }, [id]);

  const cuotasPorVenta = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const q of cuotas) {
      const key = q.venta_id ?? "SIN_VENTA";
      const arr = map.get(key) ?? [];
      arr.push(q);
      map.set(key, arr);
    }
    return map;
  }, [cuotas]);

  const ventasOrdenadas = useMemo(() => {
    const arr = [...ventas];
    arr.sort((a, b) => Number(b.saldo_pendiente) - Number(a.saldo_pendiente));
    return arr;
  }, [ventas]);

  return (
    <main style={{ maxWidth: 1100, margin: "30px auto", fontFamily: "system-ui" }}>
      <button onClick={() => router.push("/clientes")}>← Volver</button>

      {err && <p style={{ color: "crimson" }}>{err}</p>}

      <h2>{cliente?.nombre}</h2>

      {ventasOrdenadas.map((v) => {
        const cuotasDeEstaVenta = cuotasPorVenta.get(v.id) || [];

        return (
          <div key={v.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, marginTop: 16 }}>
            <div style={{ fontWeight: 700 }}>
              {v.factura_numero ? `Factura ${v.factura_numero}` : `Venta ${v.id.slice(0, 8)}`} · {v.comercio_codigo} · {v.fecha}
            </div>

            <div style={{ marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Vencimiento</th>
                    <th style={th}>Cuota</th>
                    <th style={th}>Importe</th>
                    <th style={th}>Pagado</th>
                    <th style={th}>Saldo</th>
                    <th style={th}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cuotasDeEstaVenta.map((q: any) => {
                    const saldoCuota = Number(q.importe) - Number(q.pagado);

                    return (
                      <tr key={q.id}>
                        <td style={td}>{q.vencimiento}</td>
                        <td style={td}>{q.nro}</td>
                        <td style={td}>{Number(q.importe).toFixed(2)}</td>
                        <td style={td}>{Number(q.pagado).toFixed(2)}</td>

                        {/* 👇 SALDO + BOTÓN CHIQUITO */}
                        <td style={td}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <b>{saldoCuota.toFixed(2)}</b>

                            {saldoCuota > 0.009 && (
                              <Link
                                href={`/pagos/nuevo?clienteId=${encodeURIComponent(
                                  id
                                )}&ventaId=${encodeURIComponent(v.id)}&monto=${encodeURIComponent(
                                  saldoCuota.toFixed(2)
                                )}&cuota=${encodeURIComponent(String(q.nro))}`}
                                style={{
                                  padding: "3px 8px",
                                  border: "1px solid #ddd",
                                  borderRadius: 8,
                                  fontSize: 12,
                                  textDecoration: "none",
                                }}
                              >
                                Cobrar
                              </Link>
                            )}
                          </div>
                        </td>

                        <td style={td}>{q.estado}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
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
