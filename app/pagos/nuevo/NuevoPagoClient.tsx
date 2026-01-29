"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

export default function NuevoPagoClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [ventaId, setVentaId] = useState("");

  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [ref, setRef] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // para no pisar valores que vienen desde cuotas
  const prefVentaIdRef = useRef<string>("");
  const prefClienteIdRef = useRef<string>("");

  // leer params (cuando viene desde cuota)
  useEffect(() => {
    const qClienteId = sp.get("clienteId") || "";
    const qVentaId = sp.get("ventaId") || "";
    const qMonto = sp.get("monto") || "";
    const qCuota = sp.get("cuota") || "";

    prefClienteIdRef.current = qClienteId;
    prefVentaIdRef.current = qVentaId;

    if (qClienteId) setClienteId(qClienteId);
    if (qVentaId) setVentaId(qVentaId);
    if (qMonto) setMonto(qMonto);

    if (qCuota) {
      setOk(`🧾 Cobranza sugerida: cuota ${qCuota}. (FIFO si hay anteriores)`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // cargar clientes
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id,nombre,dni")
        .order("nombre", { ascending: true })
        .limit(500);

      if (error) throw error;
      setClientes((data as any) || []);
    })().catch((e) => setErr(e.message ?? String(e)));
  }, []);

  // cargar ventas abiertas del cliente
  useEffect(() => {
    if (!clienteId) {
      setVentas([]);
      setVentaId("");
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("vw_ventas_saldo")
        .select("id,fecha,total,factura_numero,saldo_pendiente,comercio_codigo,comercio_nombre,cliente_id")
        .eq("cliente_id", clienteId)
        .order("fecha", { ascending: false });

      if (error) throw error;

      const abiertas = (data || []).filter((v: any) => Number(v.saldo_pendiente) > 0);
      setVentas(abiertas as any);

      const vieneDeCuota =
        prefClienteIdRef.current === clienteId && !!prefVentaIdRef.current;

      if (!vieneDeCuota) {
        setVentaId("");
      } else {
        const existe = abiertas.some((x: any) => x.id === prefVentaIdRef.current);
        if (!existe) setVentaId("");
      }
    })().catch((e) => setErr(e.message ?? String(e)));
  }, [clienteId]);

  const ventaSel = useMemo(
    () => ventas.find((v) => v.id === ventaId) || null,
    [ventas, ventaId]
  );

  const guardar = async () => {
    setErr(null);
    setOk(null);

    if (!clienteId) return setErr("Seleccioná un cliente.");

    const nMonto = Number(monto);
    if (!Number.isFinite(nMonto) || nMonto <= 0)
      return setErr("Monto inválido.");

    setLoading(true);
    try {
      if (ventaId) {
        const { data } = await supabase
          .from("vw_ventas_saldo")
          .select("saldo_pendiente")
          .eq("id", ventaId)
          .single();

        if (!data || Number(data.saldo_pendiente) <= 0) {
          setLoading(false);
          return setErr("La factura ya está cancelada.");
        }
      }

      const { data, error } = await supabase
        .from("pagos")
        .insert({
          cliente_id: clienteId,
          monto: nMonto,
          metodo,
          referencia: ref || null,
          venta_id: ventaId || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      router.push(`/pagos/${data.id}/comprobante?print=1`);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 800, margin: "30px auto", fontFamily: "system-ui" }}>
      <h2>Registrar pago</h2>

      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {ok && <p style={{ color: "green" }}>{ok}</p>}

      <label>Cliente</label>
      <select
        value={clienteId}
        onChange={(e) => {
          prefClienteIdRef.current = "";
          prefVentaIdRef.current = "";
          setClienteId(e.target.value);
          setVentaId("");
        }}
      >
        <option value="">Seleccionar...</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre} {c.dni ? `(${c.dni})` : ""}
          </option>
        ))}
      </select>

      <label>Factura</label>
      <select
        value={ventaId}
        onChange={(e) => setVentaId(e.target.value)}
      >
        <option value="">Pago general (FIFO)</option>
        {ventas.map((v) => (
          <option key={v.id} value={v.id}>
            {v.factura_numero ?? v.id.slice(0, 8)} · Saldo $
            {Number(v.saldo_pendiente).toFixed(2)}
          </option>
        ))}
      </select>

      {ventaSel && (
        <p>
          <b>Comercio:</b> {ventaSel.comercio_codigo} ·{" "}
          {ventaSel.comercio_nombre}
        </p>
      )}

      <label>Monto</label>
      <input value={monto} onChange={(e) => setMonto(e.target.value)} />

      <label>Método</label>
      <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
        <option value="EFECTIVO">EFECTIVO</option>
        <option value="TRANSFERENCIA">TRANSFERENCIA</option>
        <option value="MIXTO">MIXTO</option>
        <option value="OTRO">OTRO</option>
      </select>

      <label>Referencia</label>
      <input value={ref} onChange={(e) => setRef(e.target.value)} />

      <button onClick={guardar} disabled={loading}>
        {loading ? "Guardando..." : "Guardar pago"}
      </button>
    </main>
  );
}
