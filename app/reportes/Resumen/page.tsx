"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Cliente = { id: string; nombre: string; dni: string | null };

function firstDayOfMonthISO() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function lastDayOfMonthISO() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d.toISOString().slice(0, 10);
}

export default function ReporteResumenForm() {
  const router = useRouter();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");

  const [desde, setDesde] = useState(() => firstDayOfMonthISO());
  const [hasta, setHasta] = useState(() => lastDayOfMonthISO());

  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("clientes").select("id,nombre,dni").order("nombre", { ascending: true }).limit(2000);
      if (error) throw error;
      setClientes((data as any) || []);
    })().catch((e) => setErr(e?.message ?? String(e)));
  }, []);

  const generar = (print?: boolean) => {
    setErr(null);
    if (!clienteId) return setErr("Seleccioná un cliente.");
    if (!desde || !hasta) return setErr("Seleccioná desde/hasta.");
    if (desde > hasta) return setErr("Rango inválido.");

    const url = `/reportes/resumen/${clienteId}?desde=${desde}&hasta=${hasta}${print ? "&print=1" : ""}`;
    router.push(url);
  };

  return (
    <main style={{ maxWidth: 900, margin: "30px auto", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button onClick={() => router.back()}>← Volver</button>
        <h2 style={{ margin: 0 }}>Resumen de cuenta (PDF) por cliente</h2>
      </div>

      {err && <p style={{ color: "crimson" }}>{err}</p>}

      <section style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
          <div>
            <label>Cliente</label>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={input}>
              <option value="">Seleccionar...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.dni ? `(${c.dni})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Desde (vencimiento)</label>
            <input value={desde} onChange={(e) => setDesde(e.target.value)} type="date" style={input} />
          </div>

          <div>
            <label>Hasta (vencimiento)</label>
            <input value={hasta} onChange={(e) => setHasta(e.target.value)} type="date" style={input} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button onClick={() => generar(false)} style={{ padding: 12 }}>
            Ver resumen
          </button>
          <button onClick={() => generar(true)} style={{ padding: 12 }}>
            Imprimir / Guardar PDF
          </button>
        </div>

        <p style={{ marginTop: 10, opacity: 0.75 }}>
          Tip: en Chrome → Imprimir → Destino: <b>Guardar como PDF</b> y lo mandás por WhatsApp o mail.
        </p>
      </section>
    </main>
  );
}

const card: React.CSSProperties = { marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 12 };
const input: React.CSSProperties = { width: "100%", padding: 10, marginTop: 6, borderRadius: 10, border: "1px solid #ddd" };
