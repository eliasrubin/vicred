"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";

type Cliente = { id: string; nombre: string; dni: string | null };
type Comercio = { id: number; codigo: string; nombre: string };
type Estado = {
  cliente_id: string;
  disponible: number;
  deuda_total: number;
  limite_total: number;
  bloqueado_por_mora: boolean;
};

export default function NuevaVentaPage() {
  const router = useRouter();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [estados, setEstados] = useState<Record<string, Estado>>({});

  const [clienteId, setClienteId] = useState("");
  const [comercioId, setComercioId] = useState<number | "">("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [primerVenc, setPrimerVenc] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });

  const [factura, setFactura] = useState("");
  const [total, setTotal] = useState("");
  const [anticipo, setAnticipo] = useState("0");
  const [cuotas, setCuotas] = useState("6");
  const [obs, setObs] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // 🔎 buscador cliente
  const [qCliente, setQCliente] = useState("");
  const [openClientes, setOpenClientes] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const estadoSel = useMemo(() => (clienteId ? estados[clienteId] : null), [clienteId, estados]);
  const clienteSel = useMemo(() => clientes.find((c) => c.id === clienteId) || null, [clientes, clienteId]);

  useEffect(() => {
    (async () => {
      setErr(null);

      const { data: c, error: cErr } = await supabase
        .from("clientes")
        .select("id,nombre,dni")
        .order("nombre", { ascending: true })
        .limit(2000);

      if (cErr) throw cErr;
      setClientes((c as any) || []);

      const { data: co, error: coErr } = await supabase.from("comercios").select("id,codigo,nombre").order("id");
      if (coErr) throw coErr;
      setComercios((co as any) || []);

      const { data: e, error: eErr } = await supabase.from("vw_estado_credito").select("*");
      if (eErr) throw eErr;

      const map: Record<string, Estado> = {};
      (e || []).forEach((x: any) => (map[x.cliente_id] = x));
      setEstados(map);
    })().catch((e) => setErr(e.message ?? String(e)));
  }, []);

  // cerrar dropdown al click afuera
  useEffect(() => {
    const onDown = (ev: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(ev.target as any)) setOpenClientes(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const clientesFiltrados = useMemo(() => {
    const s = qCliente.trim().toLowerCase();
    if (!s) return clientes.slice(0, 50);

    const out = clientes.filter((c) => {
      const nombre = (c.nombre ?? "").toLowerCase();
      const dni = (c.dni ?? "").toLowerCase();
      return nombre.includes(s) || dni.includes(s);
    });

    return out.slice(0, 50);
  }, [qCliente, clientes]);

  const selectCliente = (c: Cliente) => {
    setClienteId(c.id);
    setQCliente(`${c.nombre}${c.dni ? ` (${c.dni})` : ""}`);
    setOpenClientes(false);
  };

  const crearVenta = async () => {
    setErr(null);
    setMsg(null);

    if (!clienteId) return setErr("Seleccioná un cliente.");
    if (!comercioId) return setErr("Seleccioná un comercio.");

    const nTotal = Number(total);
    const nAnt = Number(anticipo);
    const nCuotas = Number(cuotas);

    if (!Number.isFinite(nTotal) || nTotal <= 0) return setErr("Total inválido.");
    if (!Number.isFinite(nAnt) || nAnt < 0) return setErr("Anticipo inválido.");
    if (nAnt > nTotal) return setErr("El anticipo no puede ser mayor al total.");
    if (!Number.isInteger(nCuotas) || nCuotas <= 0) return setErr("Cuotas inválidas.");

    const est = estados[clienteId];
    if (!est) return setErr("El cliente no tiene cuenta de crédito (crear en cuentas_credito).");
    if (est.bloqueado_por_mora) return setErr("Cliente BLOQUEADO por mora (+30 días).");

    const consumo = nTotal - nAnt;
    if (consumo > Number(est.disponible)) {
      return setErr(`No alcanza el disponible. Disponible: ${Number(est.disponible).toFixed(2)}`);
    }

    const { data, error } = await supabase
      .from("ventas_credito")
      .insert({
        cliente_id: clienteId,
        comercio_id: comercioId,
        fecha,
        primer_vencimiento: primerVenc,
        factura_numero: factura.trim() || null,
        total: nTotal,
        anticipo: nAnt,
        cuotas_cantidad: nCuotas,
        observacion: obs || null,
      })
      .select("id")
      .single();

    if (error) return setErr(error.message);

    setMsg("✅ Venta creada. Cuotas generadas automáticamente.");
    router.push(`/clientes/${clienteId}`);
  };

  return (
    <main style={{ maxWidth: 900, margin: "30px auto", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Nueva venta a crédito</h2>
        <button onClick={() => router.push("/clientes")}>Volver</button>
      </div>

      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {msg && <p style={{ color: "green" }}>{msg}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
        {/* Cliente con buscador */}
        <div ref={boxRef}>
          <label>Cliente</label>

          <input
            value={qCliente}
            onChange={(e) => {
              setQCliente(e.target.value);
              setOpenClientes(true);
              // si empieza a tipear distinto al seleccionado, limpiamos selección
              if (clienteSel && e.target.value.trim() !== `${clienteSel.nombre}${clienteSel.dni ? ` (${clienteSel.dni})` : ""}`) {
                setClienteId("");
              }
            }}
            onFocus={() => setOpenClientes(true)}
            placeholder="Buscar por nombre o DNI..."
            style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 10, border: "1px solid #ddd" }}
          />

          {openClientes && (
            <div
              style={{
                marginTop: 6,
                border: "1px solid #e5e5e5",
                borderRadius: 12,
                background: "white",
                boxShadow: "0 14px 30px rgba(0,0,0,0.08)",
                maxHeight: 320,
                overflow: "auto",
              }}
            >
              {clientesFiltrados.length === 0 ? (
                <div style={{ padding: 12, opacity: 0.7 }}>(Sin resultados)</div>
              ) : (
                clientesFiltrados.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCliente(c)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: 12,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      borderBottom: "1px solid #f0f0f0",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{c.nombre}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{c.dni ? `DNI: ${c.dni}` : "DNI: -"}</div>
                  </button>
                ))
              )}
            </div>
          )}

          {estadoSel && (
            <p style={{ marginTop: 8, opacity: 0.8 }}>
              Límite: {Number(estadoSel.limite_total).toFixed(2)} · Deuda: {Number(estadoSel.deuda_total).toFixed(2)} · Disponible:{" "}
              <b>{Number(estadoSel.disponible).toFixed(2)}</b> {estadoSel.bloqueado_por_mora ? "· BLOQUEADO" : ""}
            </p>
          )}
        </div>

        <div>
          <label>Comercio</label>
          <select
            value={comercioId}
            onChange={(e) => setComercioId(e.target.value ? Number(e.target.value) : "")}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          >
            <option value="">Seleccionar...</option>
            {comercios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Fecha de venta</label>
          <input value={fecha} onChange={(e) => setFecha(e.target.value)} type="date" style={{ width: "100%", padding: 10, marginTop: 6 }} />
        </div>

        <div>
          <label>Primer vencimiento</label>
          <input
            value={primerVenc}
            onChange={(e) => setPrimerVenc(e.target.value)}
            type="date"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </div>

        <div>
          <label>N° Factura</label>
          <input
            value={factura}
            onChange={(e) => setFactura(e.target.value)}
            placeholder="Ej: A-0001-00001234"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </div>

        <div>
          <label>Cuotas (mensual)</label>
          <input value={cuotas} onChange={(e) => setCuotas(e.target.value)} inputMode="numeric" style={{ width: "100%", padding: 10, marginTop: 6 }} />
        </div>

        <div>
          <label>Total</label>
          <input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" style={{ width: "100%", padding: 10, marginTop: 6 }} />
        </div>

        <div>
          <label>Anticipo</label>
          <input value={anticipo} onChange={(e) => setAnticipo(e.target.value)} inputMode="decimal" style={{ width: "100%", padding: 10, marginTop: 6 }} />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label>Observación</label>
          <input value={obs} onChange={(e) => setObs(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }} />
        </div>
      </div>

      <button onClick={crearVenta} style={{ marginTop: 16, padding: 12, width: "100%" }}>
        Crear venta (genera cuotas)
      </button>
    </main>
  );
}
