export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const jwtSecret = process.env.JWT_SECRET;

  if (!url || !key) {
    return NextResponse.json(
      { error: "Faltan variables de Supabase en el servidor" },
      { status: 500 }
    );
  }
  if (!jwtSecret) {
    return NextResponse.json(
      { error: "Falta JWT_SECRET en el servidor" },
      { status: 500 }
    );
  }

  // En tu versión de Next, cookies() es async
  const cookieStore = await cookies();
  const token = cookieStore.get("auth")?.value;

  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dni = String(payload?.dni || "").replace(/\D/g, "");
  if (!dni) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createClient(url, key);

  // 1) CLIENTE
  const { data: cliente, error: errCliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("dni", dni)
    .maybeSingle();

  if (errCliente) {
    return NextResponse.json(
      { error: `Error Supabase (cliente): ${errCliente.message}` },
      { status: 500 }
    );
  }

  if (!cliente) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 2) CUOTAS (según tus columnas reales)
  const { data: cuotasRaw, error: errCuotas } = await supabase
    .from("cuotas")
    .select("id, nro, vencimiento, importe, estado, pagado")
    .eq("cliente_id", cliente.id)
    .order("vencimiento", { ascending: true });

  if (errCuotas) {
    return NextResponse.json(
      { error: `Error Supabase (cuotas): ${errCuotas.message}` },
      { status: 500 }
    );
  }

  // Pendientes = estado distinto de PAGADA
  const cuotasPendientes = (cuotasRaw || []).filter(
    (c) => String(c.estado || "").toUpperCase() !== "PAGADA"
  );

  const totalPendiente = cuotasPendientes.reduce(
    (acc, c) => acc + Number(c.importe || 0),
    0
  );

  const totalPagado = (cuotasRaw || []).reduce(
    (acc, c) => acc + Number(c.pagado || 0),
    0
  );

  const proximaVenc = cuotasPendientes.length
    ? cuotasPendientes[0].vencimiento
    : null;

  // 3) RESPUESTA para tu panel (mantengo nombres esperados)
  return NextResponse.json({
    cliente,
    estado: {
      total_pagado: totalPagado,
      total_pendiente: totalPendiente,
      cuotas_pendientes: cuotasPendientes.length,
      proxima_vencimiento: proximaVenc,
    },
    cuotas: cuotasPendientes.map((c) => ({
      id: c.id,
      nro_cuota: c.nro,
      vencimiento: c.vencimiento,
      monto: c.importe,
      estado: c.estado,
    })),
  });
}

