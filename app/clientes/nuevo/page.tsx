"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function NuevoClientePage() {
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");

  const [limite, setLimite] = useState("");
  const [estado, setEstado] = useState("ACTIVO");

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const guardar = async () => {
  setErr(null);
  setOk(null);

  if (!nombre.trim()) return setErr("El nombre es obligatorio.");

  const nLimite = Number(limite);
  if (!Number.isFinite(nLimite) || nLimite < 0) {
    return setErr("Límite inválido.");
  }

  setLoading(true);

  try {
    const dniClean = dni.trim();

    // 0) validar DNI duplicado
    if (dniClean) {
      const { data: exist, error: exErr } = await supabase
        .from("clientes")
        .select("id,nombre")
        .eq("dni", dniClean)
        .limit(1);

      if (exErr) throw exErr;

      if (exist && exist.length > 0) {
        setErr(`Ya existe un cliente con DNI ${dniClean}: ${exist[0].nombre}`);
        setLoading(false);
        return;
      }
    }

    // 1) crear cliente
    const { data: cliente, error: cErr } = await supabase
      .from("clientes")
      .insert({
        nombre: nombre.trim(),
        dni: dniClean || null,
        telefono: telefono.trim() || null,
        direccion: direccion.trim() || null,
        estado, // 👈 guardamos también el estado
      })
      .select("id")
      .single();

    if (cErr) throw cErr;

    const clienteId = cliente.id as string;

    // 2) crear / actualizar cuenta de crédito
    const { error: ccErr } = await supabase
      .from("cuentas_credito")
      .upsert(
        {
          cliente_id: clienteId,
          limite_total: nLimite,
        },
        { onConflict: "cliente_id" }
      );

    if (ccErr) throw ccErr;

    setOk("✅ Cliente creado y límite asignado.");
    router.push(`/clientes/${clienteId}`);
  } catch (e: any) {
    setErr(e?.message ?? String(e));
  } finally {
    setLoading(false);
  }
};

  return (
    <main style={{ maxWidth: 850, margin: "30px auto", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Nuevo cliente</h2>
        <button onClick={() => router.push("/clientes")}>Volver</button>
      </div>

      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {ok && <p style={{ color: "green" }}>{ok}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Nombre y apellido *</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }} />
        </div>

        <div>
          <label>DNI</label>
          <input value={dni} onChange={(e) => setDni(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }} />
        </div>

        <div>
          <label>Teléfono</label>
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }} />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label>Dirección</label>
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }} />
        </div>

        <div>
          <label>Límite de crédito (compartido) *</label>
          <input value={limite} onChange={(e) => setLimite(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }} />
        </div>

        <div>
          <label>Estado</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }}>
            <option value="ACTIVO">ACTIVO</option>
            <option value="OBSERVACION">OBSERVACION</option>
            <option value="BLOQUEADO">BLOQUEADO</option>
            <option value="BAJA">BAJA</option>
          </select>
        </div>
      </div>

      <button onClick={guardar} disabled={loading} style={{ marginTop: 16, padding: 12, width: "100%" }}>
        {loading ? "Guardando..." : "Crear cliente y asignar límite"}
      </button>
    </main>
  );
}
