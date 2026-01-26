"use client";

import { useEffect, useState } from "react";
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

export default function ClientesPage() {
  const [q, setQ] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [estado, setEstado] = useState<Record<string, EstadoCredito>>({});
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setErr(null);

    const { data: cData, error: cErr } = await supabase
      .from("clientes")
      .select("id,dni,nombre,telefono,created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (cErr) throw cErr;
    setClientes((cData as any) || []);

    const { data: eData, error: eErr } = await supabase
      .from("vw_estado_credito")
      .select("*");

    if (eErr) throw eErr;

    const map: Record<string, EstadoCredito> = {};
    (eData || []).forEach((x: any) => (map[x.cliente_id] = x));
    setEstado(map);
  };

  useEffect(() => {
    load().catch((e) => setErr(e.message ?? String(e)));
  }, []);

  const filtered = clientes.filter((c) => {
    const s = `${c.nombre} ${c.dni ?? ""} ${c.telefono ?? ""}`.toLowerCase();
    return s.includes(q.toLowerCase());
  });

  return (
    <main style={{ maxWidth: 950, margin: "30px auto", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
  <div>
    <h2 style={{ margin: 0 }}>Clientes</h2>
    <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
      <Link href="/ventas/nueva" style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, textDecoration: "none" }}>
        + Nueva venta
      </Link>

      <Link href="/pagos/nuevo" style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, textDecoration: "none" }}>
        + Registrar pago
      </Link>

      <Link href="/clientes/nuevo" style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, textDecoration: "none" }}>
  + Nuevo cliente
</Link>
<Link href="/reportes" style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, textDecoration: "none" }}>
  📊 Reportes
</Link>
    </div>
  </div>

  <button
    onClick={async () => {
      await supabase.auth.signOut();
      window.location.href = "/";
    }}
  >
    Salir
  </button>
</div>


      <input
        placeholder="Buscar por nombre, DNI o teléfono..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: "100%", padding: 10, margin: "12px 0" }}
      />

      {err && <p style={{ color: "crimson" }}>{err}</p>}

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
          {filtered.map((c) => {
            const e = estado[c.id];
            const st = e?.bloqueado_por_mora ? "BLOQUEADO" : e?.en_observacion ? "OBSERVACIÓN" : "ACTIVO";
            return (
              <tr key={c.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: 10 }}>
                  <Link href={`/clientes/${c.id}`}>{c.nombre}</Link>
                </td>
                <td style={{ padding: 10 }}>{c.dni ?? "-"}</td>
                <td style={{ padding: 10 }}>{e ? Number(e.disponible).toFixed(2) : "-"}</td>
                <td style={{ padding: 10 }}>{e ? Number(e.deuda_total).toFixed(2) : "-"}</td>
                <td style={{ padding: 10 }}>{st}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
