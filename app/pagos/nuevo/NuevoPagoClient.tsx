"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  cliente_id?: string;
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

  // ✅ para no pisar lo que viene precargado por URL
  const prefVentaIdRef = useRef<string>("");
  const prefClienteIdRef = useRef<string>("");
  const didApplyPrefRef = useRef(false); // ✅ aplicar una sola vez

  // ✅ leer parámetros una vez
  useEffect(() => {
    // ✅ acepta clienteId o clienteld (typo común)
    const qClienteId = sp.get("clienteId") || sp.get("clienteld") || "";
    // ✅ acepta ventaId o ventalId (typo común)
    const qVentaId = sp.get("ventaId") || sp.get("ventalId") || "";
    const qMonto = sp.get("monto") || "";
    const qCuota = sp.get("cuota") || "";

    prefClienteIdRef.current = qClienteId;
    prefVentaIdRef.current = qVentaId;

    if (qClienteId) setClienteId(qClienteId);
    if (qVentaId) setVentaId(qVentaId);
    if (qMonto) setMonto(qMonto);

    if (qCuota) {
      setOk(`🧾 Cobranza sugerida: cuota ${qCuota}. (FIFO si hay anteriores pendientes)`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ cargar clientes
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

  // ✅ cargar ventas abiertas del cliente
  useEffect(() => {
    if (!clienteId) {
      setVentas([]);
      // 👇 IMPORTANTE: no limpies ventaId si venimos desde URL (sino se pierde la preselección)
      if (!prefClienteIdRef.current) setVentaId("");
      return;
    }

    (async () => {
      setErr(null);

      const { data, error } = await supabase
        .from("vw_ventas_saldo")
        .select("id,fecha,total,factura_numero,saldo_pendiente,comercio_codigo,comercio_nombre,cliente_id")
        .eq("cliente_id", clienteId)
        .order("fecha", { ascending: false })
        .limit(200);

      if (error) throw error;

      const abiertas = (data || []).filter((v: any) => Number(v.saldo_pendiente) > 0);
      setVentas(abiertas as any);

      const prefCliente = prefClienteIdRef.current;
      const prefVenta = prefVentaIdRef.current;

      const vieneDeCuota = !!prefCliente && prefCliente === clienteId && !!prefVenta;

      if (!vieneDeCuota) {
        // selección normal (manual)
        setVentaId("");
        return;
      }

      // ✅ si venimos por URL, forzamos la preselección 1 vez (si existe dentro de las abiertas)
      const existe = abiertas.some((x: any) => x.id === prefVenta);
      if (!existe) {
        setVentaId("");
        return;
      }

      if (!didApplyPrefRef.current) {
        didApplyPrefRef.current = true;
        setVentaId(prefVenta);
      } else {
        // si por algún motivo quedó en "", la volvemos a aplicar
        if (!ventaId) setVentaId(prefVenta);
      }
    })().catch((e) => setErr(e.message ?? String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const ventaSel = useMemo(() => ventas.find((v) => v.id === ventaId) || null, [ventas, ventaId]);

  const guardar = async () => {
    setErr(null);
    setOk(null);

    if (!clienteId) return setErr("Seleccioná un cliente.");

    const nMonto = Number(monto);
    if (!Number.isFinite(nMonto) || nMonto <= 0) return setErr("Monto inválido.");

    setLoading(true);
    try {
      if (ventaId) {
        const { data, error } = await supabase
          .from("vw_ventas_saldo")
          .select("saldo_pendiente")
          .eq("id", ventaId)
          .single();
        if (error) throw error;

        if (!data || Number(data.saldo_pendiente) <= 0) {
          return setErr("Esa factura ya está cancelada. Elegí otra o dejá pago general.");
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
      if (!data?.id) throw new Error("No se pudo obtener el ID del pago.");

      router.push(`/pagos/${data.id}/comprobante?print=1`);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={{ margin: 0 }}>Registrar pago</h2>
          <div style={{ opacity: 0.7, marginTop: 4, fontSize: 13 }}>
            Registrá la cobranza y se aplica FIFO (general o por factura) según selección.
          </div>
        </div>

        <div style={styles.headerActions}>
          <button style={styles.btn} onClick={() => router.push("/pagos/historial")}>
            Historial
          </button>
          <button style={styles.btn} onClick={() => router.push("/clientes")}>
            Volver
          </button>
        </div>
      </div>

      {err && <div style={{ ...styles.alert, ...styles.alertErr }}>{err}</div>}
      {ok && <div style={{ ...styles.alert, ...styles.alertOk }}>{ok}</div>}

      <section style={styles.card}>
        <div style={styles.grid}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={styles.label}>Cliente</label>
            <select
              value={clienteId}
              onChange={(e) => {
                // al elegir manualmente, borro preferencias de URL
                prefClienteIdRef.current = "";
                prefVentaIdRef.current = "";
                didApplyPrefRef.current = false;
                setClienteId(e.target.value);
                setVentaId("");
              }}
              style={styles.input}
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
            <label style={styles.label}>Aplicar pago a factura (opcional)</label>
            <select value={ventaId} onChange={(e) => setVentaId(e.target.value)} style={styles.input} disabled={!clienteId}>
              <option value="">(Pago general al cliente - FIFO)</option>

              {ventas.length === 0 && clienteId ? (
                <option value="" disabled>
                  (No hay facturas con saldo pendiente)
                </option>
              ) : null}

              {ventas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.factura_numero ? `Factura ${v.factura_numero}` : `Venta ${v.id.slice(0, 8)}`}
                  {v.comercio_codigo ? ` · ${v.comercio_codigo}` : ""}
                  {" · "}
                  {v.fecha}
                  {" · "}
                  Saldo: ${Number(v.saldo_pendiente).toFixed(2)}
                </option>
              ))}
            </select>

            {ventaSel && (
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
                <b>Comercio:</b> {ventaSel.comercio_codigo ? `${ventaSel.comercio_codigo} · ` : ""}
                {ventaSel.comercio_nombre ?? "-"}
              </div>
            )}
          </div>

          <div>
            <label style={styles.label}>Monto</label>
            <input
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              inputMode="decimal"
              placeholder="Ej: 150000"
              style={styles.input}
            />
          </div>

          <div>
            <label style={styles.label}>Método</label>
            <select value={metodo} onChange={(e) => setMetodo(e.target.value)} style={styles.input}>
              <option value="EFECTIVO">EFECTIVO</option>
              <option value="TRANSFERENCIA">TRANSFERENCIA</option>
              <option value="MIXTO">MIXTO</option>
              <option value="OTRO">OTRO</option>
            </select>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={styles.label}>Referencia (opcional)</label>
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Ej: transferencia, nro ticket, etc."
              style={styles.input}
            />
          </div>
        </div>

        <button onClick={guardar} disabled={loading} style={{ ...styles.primary, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Guardando..." : "Guardar pago y generar comprobante"}
        </button>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 900,
    margin: "28px auto",
    padding: "0 14px",
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
  headerActions: { display: "flex", gap: 10 },
  btn: {
    padding: "10px 12px",
    border: "1px solid #ddd",
    borderRadius: 10,
    background: "white",
    cursor: "pointer",
  },
  card: {
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 16,
    background: "white",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  label: {
    display: "block",
    fontSize: 13,
    opacity: 0.8,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid #ddd",
    outline: "none",
    fontSize: 14,
  },
  primary: {
    marginTop: 14,
    padding: 14,
    width: "100%",
    borderRadius: 12,
    border: "1px solid #111",
    background: "#111",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },
  alert: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    border: "1px solid #eee",
    fontSize: 14,
  },
  alertErr: {
    borderColor: "#f2b8b8",
    background: "#fff5f5",
    color: "#a40000",
  },
  alertOk: {
    borderColor: "#bfe8c7",
    background: "#f3fff5",
    color: "#1b6b2a",
  },
};
