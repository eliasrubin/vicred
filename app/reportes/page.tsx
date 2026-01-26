"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type RowCuota = {
  cuota_id: string;
  cliente_id: string;
  cliente_nombre: string;
  dni: string | null;
  venta_id: string | null;
  factura_numero: string | null;
  comercio_codigo: string | null;
  comercio_nombre: string | null;
  nro: number;
  vencimiento: string; // yyyy-mm-dd
  importe: number;
  pagado: number;
  saldo: number;
  estado: string;
  dias_atraso: number;
};

type RowBloqueado = {
  id: string;
  nombre: string;
  dni: string | null;
  limite_total: number;
  deuda_total: number;
  disponible: number;
};

type RowDeudaComercio = {
  nombre: string;
  codigo: string | null;
  deuda_total: number;
};

export default function ReportesPage() {
  const router = useRouter();

  const [err, setErr] = useState<string | null>(null);
  const [soloVencidas30, setSoloVencidas30] = useState(true);

  const [hoy, setHoy] = useState<RowCuota[]>([]);
  const [vencidas, setVencidas] = useState<RowCuota[]>([]);
  const [bloqueados, setBloqueados] = useState<RowBloqueado[]>([]);
  const [deudaComercio, setDeudaComercio] = useState<RowDeudaComercio[]>([]);

  const load = async () => {
    setErr(null);

    // 1) Cuotas que vencen hoy (saldo > 0)
    const { data: hoyData, error: hErr } = await supabase
      .from("vw_cuotas_reportes")
      .select("*")
      .eq("vencimiento", new Date().toISOString().slice(0, 10))
      .gt("saldo", 0)
      .order("cliente_nombre", { ascending: true });

    if (hErr) throw hErr;
    setHoy((hoyData as any) || []);

    // 2) Cuotas vencidas (saldo > 0)
    const { data: venData, error: vErr } = await supabase
      .from("vw_cuotas_reportes")
      .select("*")
      .lt("vencimiento", new Date().toISOString().slice(0, 10))
      .gt("saldo", 0)
      .order("dias_atraso", { ascending: false });

    if (vErr) throw vErr;
    setVencidas((venData as any) || []);

    // 3) Bloqueados (+30 días) desde tu vista existente
    const { data: bData, error: bErr } = await supabase
      .from("vw_clientes_bloqueados")
      .select("id,nombre,dni,limite_total,deuda_total,disponible")
      .order("deuda_total", { ascending: false });

    if (bErr) throw bErr;
    setBloqueados((bData as any) || []);

    // 4) Deuda por comercio (vista existente)
    const { data: dcData, error: dcErr } = await supabase
      .from("vw_deuda_por_comercio")
      .select("nombre,codigo,deuda_total")
      .order("deuda_total", { ascending: false });

    if (dcErr) throw dcErr;
    setDeudaComercio((dcData as any) || []);
  };

  useEffect(() => {
    load().catch((e) => setErr(e.message ?? String(e)));
  }, []);

  const vencidasFiltradas = useMemo(() => {
    if (!soloVencidas30) return vencidas;
    return vencidas.filter((x) => Number(x.dias_atraso || 0) >= 30);
  }, [vencidas, soloVencidas30]);

  return (
    <main style={{ maxWidth: 1100, margin: "30px auto", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Reportes</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/clientes")}>Clientes</button>
          <button onClick={() => router.push("/ventas")}>Ventas</button>
          <button onClick={() => router.push("/pagos/nuevo")}>Registrar pago</button>
          <button onClick={() => load().catch((e) => setErr(e.message ?? String(e)))}>Actualizar</button>
        </div>
      </div>

      {err && <p style={{ color: "crimson" }}>{err}</p>}

      {/* Deuda por comercio */}
      <section style={card}>
        <div style={titleRow}>
          <h3 style={{ margin: 0 }}>Deuda por comercio</h3>
          <button onClick={() => downloadCSV("deuda_por_comercio.csv", deudaComercioCSV(deudaComercio))}>Exportar a Excel (CSV)</button>
        </div>

        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Comercio</th>
              <th style={th}>Código</th>
              <th style={th}>Deuda</th>
            </tr>
          </thead>
          <tbody>
            {deudaComercio.map((x, i) => (
              <tr key={i}>
                <td style={td}>{x.nombre}</td>
                <td style={td}>{x.codigo ?? "-"}</td>
                <td style={td}>${Number(x.deuda_total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Vencen hoy */}
      <section style={card}>
        <div style={titleRow}>
          <h3 style={{ margin: 0 }}>Cuotas que vencen hoy</h3>
          <button onClick={() => downloadCSV("cuotas_vencen_hoy.csv", hoyCSV(hoy))}>Exportar a Excel (CSV)</button>
        </div>

        <CuotasTable rows={hoy} />
      </section>

      {/* Vencidas */}
      <section style={card}>
        <div style={{ ...titleRow, alignItems: "flex-end" }}>
          <div>
            <h3 style={{ margin: 0 }}>Cuotas vencidas</h3>
            <label style={{ display: "inline-flex", gap: 8, alignItems: "center", marginTop: 8 }}>
              <input type="checkbox" checked={soloVencidas30} onChange={(e) => setSoloVencidas30(e.target.checked)} />
              Solo +30 días
            </label>
          </div>

          <button onClick={() => downloadCSV("cuotas_vencidas.csv", vencidasCSV(vencidasFiltradas))}>Exportar a Excel (CSV)</button>
        </div>

        <CuotasTable rows={vencidasFiltradas} showAtraso />
      </section>

      {/* Bloqueados */}
      <section style={card}>
        <div style={titleRow}>
          <h3 style={{ margin: 0 }}>Clientes bloqueados (+30 días)</h3>
          <button onClick={() => downloadCSV("clientes_bloqueados.csv", bloqueadosCSV(bloqueados))}>Exportar a Excel (CSV)</button>
        </div>

        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Cliente</th>
              <th style={th}>DNI</th>
              <th style={th}>Límite</th>
              <th style={th}>Deuda</th>
              <th style={th}>Disponible</th>
            </tr>
          </thead>
          <tbody>
            {bloqueados.map((x) => (
              <tr key={x.id}>
                <td style={td}>{x.nombre}</td>
                <td style={td}>{x.dni ?? "-"}</td>
                <td style={td}>${Number(x.limite_total).toFixed(2)}</td>
                <td style={td}>${Number(x.deuda_total).toFixed(2)}</td>
                <td style={td}>${Number(x.disponible).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function CuotasTable({ rows, showAtraso }: { rows: RowCuota[]; showAtraso?: boolean }) {
  return (
    <table style={table}>
      <thead>
        <tr>
          <th style={th}>Cliente</th>
          <th style={th}>Factura</th>
          <th style={th}>Comercio</th>
          <th style={th}>Vencimiento</th>
          {showAtraso ? <th style={th}>Atraso</th> : null}
          <th style={th}>N°</th>
          <th style={th}>Saldo</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((x) => (
          <tr key={x.cuota_id}>
            <td style={td}>
              {x.cliente_nombre} {x.dni ? `(${x.dni})` : ""}
            </td>
            <td style={td}>{x.factura_numero ? x.factura_numero : x.venta_id ? x.venta_id.slice(0, 8) : "-"}</td>
            <td style={td}>{x.comercio_codigo ?? "-"}</td>
            <td style={td}>{x.vencimiento}</td>
            {showAtraso ? <td style={td}>{Number(x.dias_atraso || 0)} días</td> : null}
            <td style={td}>{x.nro}</td>
            <td style={td}>
              <b>${Number(x.saldo).toFixed(2)}</b>
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td style={td} colSpan={showAtraso ? 7 : 6}>
              (No hay datos)
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/* ========== EXPORT CSV ========== */
function downloadCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows || rows.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }
  const headers = Object.keys(rows[0]);

  const escape = (val: any) => {
    const s = String(val ?? "");
    const needsQuotes = s.includes(",") || s.includes("\n") || s.includes('"');
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function hoyCSV(rows: RowCuota[]) {
  return rows.map((x) => ({
    cliente: x.cliente_nombre,
    dni: x.dni ?? "",
    factura: x.factura_numero ?? (x.venta_id ? x.venta_id.slice(0, 8) : ""),
    comercio: x.comercio_codigo ?? "",
    vencimiento: x.vencimiento,
    cuota_nro: x.nro,
    saldo: Number(x.saldo ?? 0).toFixed(2),
  }));
}

function vencidasCSV(rows: RowCuota[]) {
  return rows.map((x) => ({
    cliente: x.cliente_nombre,
    dni: x.dni ?? "",
    factura: x.factura_numero ?? (x.venta_id ? x.venta_id.slice(0, 8) : ""),
    comercio: x.comercio_codigo ?? "",
    vencimiento: x.vencimiento,
    dias_atraso: x.dias_atraso ?? 0,
    cuota_nro: x.nro,
    saldo: Number(x.saldo ?? 0).toFixed(2),
  }));
}

function bloqueadosCSV(rows: RowBloqueado[]) {
  return rows.map((x) => ({
    cliente: x.nombre,
    dni: x.dni ?? "",
    limite: Number(x.limite_total ?? 0).toFixed(2),
    deuda: Number(x.deuda_total ?? 0).toFixed(2),
    disponible: Number(x.disponible ?? 0).toFixed(2),
  }));
}

function deudaComercioCSV(rows: RowDeudaComercio[]) {
  return rows.map((x) => ({
    comercio: x.nombre,
    codigo: x.codigo ?? "",
    deuda: Number(x.deuda_total ?? 0).toFixed(2),
  }));
}

/* ========== STYLES ========== */
const card: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  border: "1px solid #eee",
  borderRadius: 12,
};

const titleRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 10,
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
