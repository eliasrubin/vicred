export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

type Estado = {
  limite: number;
  deuda_total: number;
  disponible: number;
  cuotas_pendientes: number;
  cuotas_pagadas: number;
  proximo_vencimiento: string | null;
};

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
    return NextResponse.json({ error: "Falta JWT_SECRET en el servidor" }, { status: 500 });
  }

  const token = (await cookies()).get("auth")?.value;
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let payload: any;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dni = String(payload?.dni || "").replace(/\D/g, "");
  if (!dni) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = createClient(url, key);

  // 1) Cliente
  const { data: cliente, error: eCliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("dni", dni)
    .maybeSingle();

  if (eCliente || !cliente) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 2) Límite (cuentas_credito)
  const { data: cuenta, error: eCuenta } = await supabase
    .from("cuentas_credito")
    .select("limite")
    .eq("cliente_id", cliente.id)
    .maybeSingle();

  // Si no existe cuenta, lo tomamos como 0 (para no romper el portal)
  const limite = Number((cuenta as any)?.limite ?? 0) || 0;

  // 3) Cuotas del cliente
  const { data: cuotasRaw, error: eCuotas } = await supabase
    .from("cuotas")
    .select("id, venta_id, cliente_id, nro, vencimiento, importe, pagado, estado")
    .eq("cliente_id", cliente.id)
    .order("vencimiento", { ascending: true });

  if (eCuotas) {
    return NextResponse.json({ error: `Error cuotas: ${eCuotas.message}` }, { status: 500 });
  }

  const cuotas = Array.isArray(cuotasRaw) ? cuotasRaw : [];

  // 4) Traer ventas vinculadas (para "factura" y detalle)
  const ventaIds = Array.from(new Set(cuotas.map((c: any) => c.venta_id).filter(Boolean)));

  const ventasById: Record<string, any> = {};
  if (ventaIds.length) {
    const { data: ventas, error: eVentas } = await supabase
     .from("ventas_credito")
     .select("id, fecha, total, anticipo, forma_pago, factura_numero")
     .in("id", ventaIds);

    if (eVentas) {
      return NextResponse.json({ error: `Error ventas: ${eVentas.message}` }, { status: 500 });
    }

    (ventas || []).forEach((v: any) => {
      ventasById[v.id] = v;
    });
  }

  // 5) Pagos aplicados a cuotas (para fecha de pago)
  // Suposición de modelo: pagos_aplicaciones(cuota_id, pago_id, importe) y pagos(id, fecha, importe)
  const cuotaIds = cuotas.map((c: any) => c.id);
  const pagosPorCuota: Record<string, any[]> = {};

  if (cuotaIds.length) {
    const { data: apps, error: eApps } = await supabase
      .from("pagos_aplicaciones")
      .select("id, cuota_id, pago_id, importe, pagos:pagos (id, fecha, importe)")
      .in("cuota_id", cuotaIds);

    // Si esta consulta falla por nombres/relaciones, no rompemos el portal:
    if (!eApps && Array.isArray(apps)) {
      for (const a of apps as any[]) {
        if (!pagosPorCuota[a.cuota_id]) pagosPorCuota[a.cuota_id] = [];
        pagosPorCuota[a.cuota_id].push({
          id: a?.pagos?.id ?? a.pago_id,
          fecha: a?.pagos?.fecha ?? null,
          importe: a.importe ?? null,
        });
      }
    }
  }

  // 6) Armar cuotas “enriquecidas”
  const cuotasEnriquecidas = cuotas.map((c: any) => {
    const venta = ventasById[c.venta_id] || null;
    const pagos = pagosPorCuota[c.id] || [];

    // fecha de pago: tomamos la más reciente si hay varias
    const pagoFecha =
      pagos
        .map((p: any) => p.fecha)
        .filter(Boolean)
        .sort()
        .slice(-1)[0] ?? null;

    return {
      ...c,
      venta,
      pago_fecha: pagoFecha,
      pagos,
    };
  });

  // 7) Estado de crédito (deuda, disponible, contadores)
  let deudaTotal = 0;
  let cuotasPendientes = 0;
  let cuotasPagadas = 0;
  let proximoVenc: string | null = null;

  for (const c of cuotasEnriquecidas as any[]) {
    const estado = String(c.estado || "").toUpperCase();
    const importe = Number(c.importe ?? 0) || 0;
    const pagado = Number(c.pagado ?? 0) || 0;
    const pendiente = Math.max(0, importe - pagado);

    if (estado === "PAGADA" || pendiente === 0) {
      cuotasPagadas += 1;
    } else {
      cuotasPendientes += 1;
      deudaTotal += pendiente;
      const v = c.vencimiento ? String(c.vencimiento).slice(0, 10) : null;
      if (v && (!proximoVenc || v < proximoVenc)) proximoVenc = v;
    }
  }

  const disponible = Math.max(0, limite - deudaTotal);

  const estado: Estado = {
    limite,
    deuda_total: deudaTotal,
    disponible,
    cuotas_pendientes: cuotasPendientes,
    cuotas_pagadas: cuotasPagadas,
    proximo_vencimiento: proximoVenc,
  };

  return NextResponse.json({
    cliente,
    estado,
    cuotas: cuotasEnriquecidas,
  });
}
