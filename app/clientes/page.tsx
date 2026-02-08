"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Cliente = {
  id: string;
  dni: string | null;
  nombre: string;
  telefono: string | null;
};

type EstadoCredito = {
  cliente_id: string;
  limite_total: number;
  deuda_total: number;
  disponible: number;
  en_observacion: boolean;
  bloqueado_por_mora: boolean;
};

type OrdenCampo = "nombre" | "deuda";
type OrdenDir = "asc" | "desc";

export default function ClientesPage() {
  const [q, setQ] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [estado, setEstado] = useState<Record<string, EstadoCredito>>({});
  const [err, setErr] = useState<string | null>(null);

  // ✅ NUEVO: orden
  const [ordenCampo, setOrdenCampo] = useState<OrdenCampo>("nombre");
  const [ordenDir, setOrdenDir] = useState<OrdenDir>("asc");

  const load = async () => {
    setErr(null);

    const { data: cData, error: cErr } = await supabase
      .from("clientes")
      .select("id,dni,nombre,telefono,created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (cErr) throw cErr;
    setClientes((cData as any) || []);

    const { data: eData, error: eErr } = await supabase.from("vw_estado_credito").select("*");

    if (eErr) throw eErr;

    const map: Record<string, EstadoCredito> = {};
    (eData || []).forEach((x: any) => (map[x.cliente_id] = x));
    setEstado(map);
  };

  useEffect(() => {
    load().catch((e) => setErr(e.message ?? String(e)));
  }, []);

  // ✅ filtrado por buscador
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return clientes;

    return clientes.filter((c) => {
      const hay = `${c.nombre} ${c.dni ?? ""} ${c.telefono ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [q, clientes]);

  // ✅ ordenado (sobre lo filtrado)
  const ordered = useMemo(() => {
    const arr = [...filtered];
    const dir = ordenDir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      if (ordenCampo === "nombre") {
        const aa = String(a.nombre ?? "").toLowerCase();
        const bb = String(b.nombre ?? "").toLowerCase();
        return aa.localeCompare(bb) * dir;
      }

      // deuda
      const da = Number(estado[a.id]?.deuda_total ?? 0) || 0;
      const db = Number(estado[b.id]?.deuda_total ?? 0) || 0;

      // si hay empate, desempate por nombre asc
      if (da === db) {
        const aa = String(a.nombre ?? "").toLowerCase();
        const bb = String(b.nombre ?? "").toLowerCase();
        return aa.localeCompare(bb) * 1;
      }

      return (da - db) * dir;
    });

    return arr;
  }, [filtered, ordenCampo, ordenDir, estado]);

  return (
    <main style={{ maxWidth: 950, margin: "30px auto", fontFamily: "system-ui", padding: "0 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Clientes</h2>

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <Link href="/ventas/nueva" style={btnLink}>
              + Nueva venta
            </Link>

            <Link href="/pagos/nuevo" style={btnLink}>
              + Registrar pago
            </Link>

            <Link href="/clientes/nuevo" style={btnLink}>
              + Nuevo cliente
            </Link>

            <Link href="/reportes" style={btnLink}>
              📊 Reportes
            </Link>
          </div>
        </div>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/";
          }}
          style={btn}
        >
          Salir
        </button>
      </div>

      {/* Buscar */}
      <input
        placeholder="Buscar por nombre, DNI o teléfono..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: "100%", padding: 12, margin: "12px 0", borderRadius: 10, border: "1px solid #ddd" }}
      />

      {/* ✅ NUEVO: Filtros de orden */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: 12, marginBottom: 12 }}>
        <select value={ordenCampo} onChange={(e) => setOrdenCampo(e.target.value as OrdenCampo)} style={input}>
          <option value="nombre">Ordenar por: Nombre</option>
          <option value="deuda">Ordenar por: Deuda</option>
        </select>

        <select value={ordenDir} onChange={(e) => setOrdenDir(e.target.value as OrdenDir)} style={input}>
          <option value="asc">Ascendente</option>
          <option value="desc">Descendente</option>
        </select>

        <button
          onClick={() => {
            setQ("");
            setOrdenCampo("nombre");
            setOrdenDir("asc");
          }}
          style={btn}
        >
          Limpiar
        </button>
      </div>

      {err && <p style={{ color: "crimson" }}>{err}</p>}

      <div style={{ opacity: 0.75, marginBottom: 8 }}>
        Mostrando <b>{ordered.length}</b> de <b>{clientes.length}</b>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th style={{ padding: 10 }}>Cliente</th>
            <th style={{ padding: 10 }}>DNI</th>
            <th style={{ padding: 10 }}>Disponible</th>
            <th style={{ padding: 10 }}>Deuda</th>
            <th style={{ padding: 10 }}>Estado</th>
          </tr>
        </thead>

        <tbody>
          {ordered.map((c) => {
            const e = estado[c.id];
            const st = e?.bloqueado_por_mora ? "BLOQUEADO" : e?.en_observacion ? "OBSERVACIÓN" : "ACTIVO";

            return (
              <tr key={c.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: 10 }}>
                  <Link href={`/clientes/${c.id}`} style={{ textDecoration: "none" }}>
                    {c.nombre}
                  </Link>
                </td>
                <td style={{ padding: 10 }}>{c.dni ?? "-"}</td>
                <td style={{ padding: 10 }}>{e ? Number(e.disponible).toFixed(2) : "-"}</td>
                <td style={{ padding: 10 }}>{e ? Number(e.deuda_total).toFixed(2) : "-"}</td>
                <td style={{ padding: 10 }}>{st}</td>
              </tr>
            );
          })}

          {ordered.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 12, opacity: 0.7 }}>
                (No hay resultados)
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}

const btnLink: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #ddd",
  borderRadius: 10,
  textDecoration: "none",
  color: "#111",
  background: "white",
};

const btn: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #ddd",
  borderRadius: 10,
  background: "white",
  cursor: "pointer",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  outline: "none",
};
