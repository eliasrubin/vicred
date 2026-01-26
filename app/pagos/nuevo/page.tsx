"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Cliente = { id: string; nombre: string; dni: string | null };

type Venta = {
  id: string;
  fecha: string;
  total: number;
  factura_numero: string | null;
  saldo_pendiente: number;
  comercio_codigo?: string | null;
  comercio_nombre?: string | null;
};

export default function NuevoPago() {
  const router = useRouter();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [ventaId, setVentaId] = useState(""); // factura/venta seleccionada (opcional)

  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [ref, setRef] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Cargar clientes
  useEffect(() => {
    (async () => {
      setErr(null);
      const { data, error } = await supabase
        .from("clientes")
        .select("id,nombre,dni")
        .order("nombre", { ascending: true })
        .limit(500);

      if (error) throw error;
      setClientes((data as any) || []);
    })().catch((e) => setErr(e.message ?? String(e)));
  }, []);

  // Cuando elijo cliente, cargar SOLO ventas con saldo pendiente > 0
  useEffect(() => {
    if (!clienteId) {
      setVentas([]);
      setVentaId("");
      return;
    }

    (async () => {
      setErr(null);

      const { data, error } = await supabase
        .from("vw_ventas_saldo")
        .select("id,fecha,total,factura_numero,saldo_pendiente,comercio_codigo,comercio_nombre")
        .eq("cliente_id", clienteId)
        .order("fecha", { ascending: false })
        .limit(200);

      if (error) throw error;

      const abiertas = (data || []).filter((v: any) => Number(v.saldo_pendiente) > 0);

      setVentas(abiertas as any);
      setVentaId(""); // reset factura al cambiar cliente
    })().catch((e) => setErr(e.message ?? String(e)));
  }, [clienteId]);

  const guardar = async () => {
    setErr(null);
    setOk(null);

    if (!clienteId) return setErr("Seleccioná un cliente.");

    const nMonto = Number(monto);
    if (!Number.isFinite(nMonto) || nMonto <= 0) return setErr("Monto inválido.");

    setLoading(true);
    try {
      // Seguridad extra: si eligió factura, verificar saldo pendiente actual
      if (ventaId) {
        const { data, error } = await supabase
          .from("vw_ventas_saldo")
          .select("saldo_pendiente")
          .eq("id", ventaId)
          .single();

        if (error) throw error;

        if (!data || Number(data.saldo_pendiente) <= 0) {
          setLoading(false);
          return setErr("Esa factura ya está cancelada. Elegí otra o dejá pago general.");
        }
      }

      // ✅ Insert devolviendo ID para generar comprobante
      const { data, error } = await supabase
        .from("pagos")
        .insert({
          cliente_id: clienteId,
          monto: nMonto,
          metodo,
          referencia: ref || null,
          venta_id: ventaId || null, // 👈 si elegís factura => FIFO por factura (trigger DB)
        })
        .select("id")
        .single();

      if (error) throw error;
      if (!data?.id) throw new Error("No se pudo obtener el ID del pago.");

      setOk(
        ventaId
          ? "✅ Pago registrado y aplicado a la factura seleccionada (FIFO por factura). Generando comprobante..."
          : "✅ Pago registrado y aplicado automáticamente a las cuotas (FIFO general). Generando comprobante..."
      );

      // ✅ Ir al comprobante (y abrir imprimir / guardar PDF)
      router.push(`/pagos/${data.id}/comprobante?print=1`);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 800, margin: "30px auto", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Registrar pago</h2>
        <div style={{ display: "flex", gap: 10 }}>
    <button onClick={() => router.push("/pagos/historial")}>Historial</button>
    <button onClick={() => router.push("/clientes")}>Volver</button>
  </div>
</div>

      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {ok && <p style={{ color: "green" }}>{ok}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Cliente</label>
          <select
            value={clienteId}
            onChange={(e) => {
              setClienteId(e.target.value);
              setVentaId("");
            }}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          >
            <option value="">Seleccionar...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {c.dni ? `(${c.dni})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label>Aplicar pago a factura (opcional)</label>
          <select
            value={ventaId}
            onChange={(e) => setVentaId(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            disabled={!clienteId}
          >
            <option value="">(Pago general al cliente - FIFO)</option>

            {ventas.length === 0 && clienteId ? (
              <option value="" disabled>
                (No hay facturas con saldo pendiente)
              </option>
            ) : null}

            {ventas.map((v) => (
              <option key={v.id} value={v.id}>
                {(v.factura_numero ? `Factura ${v.factura_numero}` : `Venta ${v.id.slice(0, 8)}`)}
                {v.comercio_codigo ? ` · ${v.comercio_codigo}` : ""}
                {" · "}
                {v.fecha}
                {" · "}
                Saldo: ${Number(v.saldo_pendiente).toFixed(2)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Monto</label>
          <input
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            inputMode="decimal"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </div>

        <div>
          <label>Método</label>
          <select value={metodo} onChange={(e) => setMetodo(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }}>
            <option value="EFECTIVO">EFECTIVO</option>
            <option value="TRANSFERENCIA">TRANSFERENCIA</option>
            <option value="MIXTO">MIXTO</option>
            <option value="OTRO">OTRO</option>
          </select>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label>Referencia (opcional)</label>
          <input value={ref} onChange={(e) => setRef(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }} />
        </div>
      </div>

      <button onClick={guardar} disabled={loading} style={{ marginTop: 16, padding: 12, width: "100%" }}>
        {loading ? "Guardando..." : "Guardar pago y generar comprobante"}
      </button>
    </main>
  );
}


