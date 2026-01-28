export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const jwtSecret = process.env.JWT_SECRET;

  if (!url || !key) {
    return NextResponse.json({ error: "Faltan variables de Supabase en el servidor" }, { status: 500 });
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

  // Cliente
  const { data: cliente, error: eCliente } = await supabase
    .from("clientes")
    .select("id, dni")
    .eq("dni", dni)
    .maybeSingle();

  if (eCliente || !cliente) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Venta (debe pertenecer al cliente)
  const { data: venta, error: eVenta } = await supabase
    .from("ventas_credito")
    .select("id, fecha, total, anticipo, cuotas_cantidad, observacion, created_at, factura_numero, comercio_id, primer_vencimiento, cliente_id")
    .eq("id", id)
    .maybeSingle();

  if (eVenta) return NextResponse.json({ error: `Error venta: ${eVenta.message}` }, { status: 500 });
  if (!venta || venta.cliente_id !== cliente.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Cuotas de esa venta + fecha de pago si existe
  const { data: cuotas, error: eCuotas } = await supabase
    .from("cuotas")
    .select("id, venta_id, cliente_id, nro, vencimiento, importe, pagado, estado")
    .eq("venta_id", id)
    .eq("cliente_id", cliente.id)
    .order("nro", { ascending: true });

  if (eCuotas) return NextResponse.json({ error: `Error cuotas: ${eCuotas.message}` }, { status: 500 });

  const cuotasList = Array.isArray(cuotas) ? cuotas : [];
  const cuotaIds = cuotasList.map((c: any) => c.id);

  const pagosPorCuota: Record<string, any[]> = {};
  if (cuotaIds.length) {
    const { data: apps } = await supabase
      .from("pagos_aplicaciones")
      .select("cuota_id, pagos:pagos (fecha)")
      .in("cuota_id", cuotaIds);

    if (Array.isArray(apps)) {
      for (const a of apps as any[]) {
        if (!pagosPorCuota[a.cuota_id]) pagosPorCuota[a.cuota_id] = [];
        if (a?.pagos?.fecha) pagosPorCuota[a.cuota_id].push(a.pagos.fecha);
      }
    }
  }

  const cuotasEnriq = cuotasList.map((c: any) => {
    const fechas = (pagosPorCuota[c.id] || []).map(String).sort();
    const pago_fecha = fechas.length ? fechas[fechas.length - 1] : null;
    return { ...c, pago_fecha };
  });

  return NextResponse.json({
    venta: { ...venta, cliente_id: undefined }, // no hace falta exponerlo
    cuotas: cuotasEnriq,
  });
}
