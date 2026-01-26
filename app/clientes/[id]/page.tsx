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

    // ✅ Ventas con saldo pendiente (para ver facturas "abiertas")
    const { data: v, error: vErr } = await supabase
      .from("vw_ventas_saldo")
      .select("id,cliente_id,fecha,total,factura_numero,comercio_id,comercio_nombre,comercio_codigo,saldo_pendiente")
      .eq("cliente_id", id)
      .order("fecha", { ascending: false })
      .limit(200);

    if (vErr) throw vErr;
    setVentas(((v as any) || []) as VentaSaldo[]);

    // ✅ Cuotas del cliente (todas)
    const { data: q, error: qErr } = await supabase
      .from("cuotas")
      .select("id,nro,vencimiento,importe,pagado,estado,venta_id")
      .eq("cliente_id", id)
      .order("vencimiento", { ascending: true });

    if (qErr) throw qErr;
    setCuotas((q as any) || []);
  };

  useEffect(() => {
    if (!id) return;
    load().catch((e) => setErr(e.message ?? String(e)));
  }, [id]);

  const st = estado?.bloqueado_por_mora ? "BLOQUEADO" : estado?.en_observacion ? "OBSERVACIÓN" : "ACTIVO";

  // Agrupar cuotas por venta_id
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

  // Ordenar ventas: primero las que tienen saldo > 0, luego las saldadas
  const ventasOrdenadas = useMemo(() => {
    const arr = [...ventas];
    arr.sort((a, b) => {
      const sa = Number(a.saldo_pendiente);
      const sb = Number(b.saldo_pendiente);
      if (sa > 0 && sb === 0) return -1;
      if (sa === 0 && sb > 0) return 1;
      // por fecha desc
      return String(b.fecha).localeCompare(String(a.fecha));
    });
    return arr;
  }, [ventas]);

  return (
    <main style={{ maxWidth: 1100, margin: "30px auto", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button onClick={() => router.push("/clientes")}>← Volver</button>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/ventas/nueva" style={btnLink}>
            + Nueva venta
          </Link>
          <Link href="/pagos/nuevo" style={btnLink}>
            + Registrar pago
          </Link>
          <Link href="/reportes" style={btnLink}>
            📊 Reportes
          </Link>
          <Link href="/pagos/historial" style={btnLink}>
            🧾 Historial cobranzas
          </Link>
        </div>
      </div>

      {err && <p style={{ color: "crimson" }}>{err}</p>}

      <h2 style={{ marginTop: 16 }}>{cliente?.nombre ?? "Cliente"}</h2>
      <p style={{ opacity: 0.8 }}>
        DNI: {cliente?.dni ?? "-"} · Tel: {cliente?.telefono ?? "-"} · Dirección: {cliente?.direccion ?? "-"}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, margin: "16px 0" }}>
        <Card title="Límite" value={estado ? Number(estado.limite_total).toFixed(2) : "-"} />
        <Card title="Disponible" value={estado ? Number(estado.disponible).toFixed(2) : "-"} />
        <Card title="Deuda" value={estado ? Number(estado.deuda_total).toFixed(2) : "-"} />
        <Card title="Estado" value={st} />
        <Card title="Mora +30" value={estado?.bloqueado_por_mora ? "Sí" : "No"} />
      </div>

      {/* FACTURAS / VENTAS */}
      <section style={card}>
        <h3 style={{ marginTop: 0 }}>Facturas / Ventas</h3>
        <p style={{ opacity: 0.8 }}>
          Tip: las que tienen <b>saldo pendiente</b> aparecen primero. Si está en 0, la factura está cancelada.
        </p>

        {ventasOrdenadas.map((v) => {
          const saldo = Number(v.saldo_pendiente || 0);
          const cuotasDeEstaVenta = cuotasPorVenta.get(v.id) || [];
          const cuotasPendientes = cuotasDeEstaVenta.filter((q) => q.estado !== "PAGADA");
          const cuotasPagadas = cuotasDeEstaVenta.filter((q) => q.estado === "PAGADA");

          return (
            <div key={v.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {v.factura_numero ? `Factura ${v.factura_numero}` : `Venta ${v.id.slice(0, 8)}`}
                    {" · "}
                    {v.comercio_codigo}
                    {" · "}
                    {v.fecha}
                  </div>
                  <div style={{ opacity: 0.8, marginTop: 4 }}>
                    Total: ${Number(v.total).toFixed(2)} · Cuotas: {cuotasDeEstaVenta.length} · Pendientes: {cuotasPendientes.length} · Pagadas:{" "}
                    {cuotasPagadas.length}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Saldo pendiente</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: saldo > 0 ? "black" : "#666" }}>${saldo.toFixed(2)}</div>

                  {/* Acciones: Cobrar + Pagarés */}
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 8 }}>
                    {saldo > 0 ? (
                      <Link href={`/pagos/nuevo`} style={{ ...btnLink, display: "inline-block" }}>
                        Cobrar
                      </Link>
                    ) : (
                      <span style={{ fontSize: 12, opacity: 0.7, padding: "8px 10px", border: "1px solid #eee", borderRadius: 8 }}>
                        Cancelada
                      </span>
                    )}

                    <Link href={`/ventas/${v.id}/pagares?print=1`} style={{ ...btnLink, display: "inline-block" }}>
                      Pagarés (PDF)
                    </Link>

                    <Link href={`/ventas/${v.id}/pagares`} style={{ ...btnLink, display: "inline-block" }}>
                      Ver pagarés
                    </Link>
                  </div>
                </div>
              </div>

              {/* Cuotas de esa factura */}
              <div style={{ marginTop: 10 }}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Vencimiento</th>
                      <th style={th}>N°</th>
                      <th style={th}>Importe</th>
                      <th style={th}>Pagado</th>
                      <th style={th}>Saldo</th>
                      <th style={th}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuotasDeEstaVenta.map((q: any) => {
                      const qs = Number(q.importe) - Number(q.pagado);
                      return (
                        <tr key={q.id}>
                          <td style={td}>{q.vencimiento}</td>
                          <td style={td}>{q.nro}</td>
                          <td style={td}>{Number(q.importe).toFixed(2)}</td>
                          <td style={td}>{Number(q.pagado).toFixed(2)}</td>
                          <td style={td}>
                            <b>{qs.toFixed(2)}</b>
                          </td>
                          <td style={td}>{q.estado}</td>
                        </tr>
                      );
                    })}
                    {cuotasDeEstaVenta.length === 0 && (
                      <tr>
                        <td style={td} colSpan={6}>
                          (No hay cuotas asociadas a esta venta)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {ventasOrdenadas.length === 0 && <p style={{ opacity: 0.8 }}>(Este cliente no tiene ventas todavía)</p>}
      </section>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{title}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{value}</div>
    </div>
  );
}

const btnLink: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #ddd",
  borderRadius: 8,
  textDecoration: "none",
};

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
};

const td: React.CSSProperties = {
  padding: 10,
  borderBottom: "1px solid #f0f0f0",
};

