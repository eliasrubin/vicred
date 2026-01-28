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

  if (!url || !key) return NextResponse.json({ error: "Faltan variables de Supabase en el servidor" }, { status: 500 });
  if (!jwtSecret) return NextResponse.json({ error: "Falta JWT_SECRET en el servidor" }, { status: 500 });

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

  // Cuota (debe pertenecer al cliente)
  const { data: cuota, error: eCuota } = await supabase
    .from("cuotas")
    .select("id, venta_id, cliente_id, nro, vencimiento, importe, pagado, estado")
    .eq("id", id)
    .maybeSingle();

  if (eCuota) return NextResponse.json({ error: `Error cuota: ${eCuota.message}` }, { status: 500 });
  if (!cuota || cuota.cliente_id !== cliente.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Venta relacionada
  let venta: any = null;
  if (cuota.venta_id) {
    const { data: v } = await supabase
      .from("ventas_credito")
      .select("id, fecha, total, anticipo, factura_numero")
      .eq("id", cuota.venta_id)
      .maybeSingle();
    venta = v ?? null;
  }

  // Pagos aplicados (si existe modelo)
  const pagos: any[] = [];
  const { data: apps } = await supabase
    .from("pagos_aplicaciones")
    .select("id, importe, pagos:pagos (id, fecha, importe)")
    .eq("cuota_id", cuota.id);

  if (Array.isArray(apps)) {
    for (const a of apps as any[]) {
      pagos.push({
        id: a?.pagos?.id ?? a.id,
        fecha: a?.pagos?.fecha ?? null,
        importe: a?.importe ?? null,
      });
    }
  }

  return NextResponse.json({ cuota, venta, pagos });
}
