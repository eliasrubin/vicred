export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ✅ Usamos el mismo secret que el login Vicred
  const jwtSecret = process.env.VICRED_JWT_SECRET;

  if (!url || !key) {
    return NextResponse.json(
      { error: "Faltan variables de Supabase en el servidor" },
      { status: 500 }
    );
  }
  if (!jwtSecret) {
    return NextResponse.json(
      { error: "Falta VICRED_JWT_SECRET en el servidor" },
      { status: 500 }
    );
  }

  // ✅ Usamos la cookie real del portal Vicred
const cookieStore = await cookies();
const token = cookieStore.get("vicred_session")?.value;
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let payload: any;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const cliente_id = payload?.cliente_id;
  if (!cliente_id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = createClient(url, key);

  // 1) Cliente (por ID, que es lo que viene en el JWT)
  const { data: cliente, error: eCliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", cliente_id)
    .maybeSingle();

  if (eCliente || !cliente) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 2) Cuotas del cliente
  const { data: cuotasRaw, error: eCuotas } = await supabase
    .from("cuotas")
    .select("id, venta_id, cliente_id, nro, vencimiento, importe, pagado, estado, factura_numero")
    .eq("cliente_id", cliente.id)
    .order("vencimiento", { ascending: true });

  if (eCuotas) {
    return NextResponse.json({ error: `Error cuotas: ${eCuotas.message}` }, { status: 500 });
  }

  const cuotas = Array.isArray(cuotasRaw) ? cuotasRaw : [];

  // 3) Ventas vinculadas
  const ventaIds = Array.from(new Set(cuotas.map((c: any) => c.venta_id).filter(Boolean)));

  const ventasById: Record<string, any> = {};
  if (ventaIds.length) {
    const { data: ventas, error: eVentas } = await supabase
      .from("ventas_credito")
      .select("id, fecha, total, anticipo, cuotas_cantidad, observacion, factura_numero, comercio_id, primer_vencimiento")
      .in("id", ventaIds);

    if (eVentas) {
      return NextResponse.json({ error: `Error ventas: ${eVentas.message}` }, { status: 500 });
    }

    (ventas || []).forEach((v: any) => {
      ventasById[v.id] = v;
    });
  }

  // 4) Fecha de pago (si existe pagos_aplicaciones + pagos)
  const cuotaIds = cuotas.map((c: any) => c.id);
  const pagosPorCuota: Record<string, any[]> = {};

  if (cuotaIds.length) {
    const { data: apps, error: eApps } = await supabase
      .from("pagos_aplicaciones")
      .select("id, cuota_id, pago_id, importe, pagos:pagos (id, fecha, importe)")
      .in("cuota_id", cuotaIds);

    // Si falla (por relaciones/nombres), no rompemos el portal
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

  // 5) Cuotas enriquecidas
  const cuotasEnriquecidas = cuotas.map((c: any) => {
    const venta = ventasById[c.venta_id] || null;
    const pagos = pagosPorCuota[c.id] || [];

    const pagoFecha =
      pagos
        .map((p: any) => p.fecha)
        .filter(Boolean)
        .sort()
        .slice(-1)[0] ?? null;

    return {
      ...c,
      factura_numero: c?.factura_numero ?? venta?.factura_numero ?? null,
      venta,
      pago_fecha: pagoFecha,
      pagos,
    };
  });

  // ✅ 6) Estado desde la vista vw_estado_credito (fuente única de verdad)
  const { data: estado, error: eEstado } = await supabase
    .from("vw_estado_credito")
    .select("*")
    .eq("cliente_id", cliente.id)
    .maybeSingle();

  if (eEstado) {
    return NextResponse.json(
      { error: `Error estado crédito: ${eEstado.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    cliente,
    estado: estado ?? {},
    cuotas: cuotasEnriquecidas,
  });
}
