export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

export async function GET(_: Request, ctx: { params: Promise<{ ventaId: string }> }) {
  const { ventaId } = await ctx.params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const jwtSecret = process.env.JWT_SECRET;

  if (!url || !key) return NextResponse.json({ error: "Faltan variables Supabase" }, { status: 500 });
  if (!jwtSecret) return NextResponse.json({ error: "Falta JWT_SECRET" }, { status: 500 });

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

  const { data: cliente } = await supabase.from("clientes").select("id, dni").eq("dni", dni).maybeSingle();
  if (!cliente) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: venta, error: eVenta } = await supabase
    .from("ventas_credito")
    .select("id, cliente_id, fecha, total, anticipo, forma_pago, factura_numero")
    .eq("id", ventaId)
    .maybeSingle();

  if (eVenta || !venta) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  if (venta.cliente_id !== cliente.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: cuotas, error: eCuotas } = await supabase
    .from("cuotas")
    .select("id, nro, vencimiento, importe, pagado, estado")
    .eq("venta_id", ventaId)
    .order("nro", { ascending: true });

  if (eCuotas) return NextResponse.json({ error: eCuotas.message }, { status: 500 });

  return NextResponse.json({ venta, cuotas: cuotas || [] });
}