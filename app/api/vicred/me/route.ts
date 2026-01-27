export const runtime = "nodejs";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/vicred_session=([^;]+)/);

  if (!match) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const token = decodeURIComponent(match[1]);
    const payload = jwt.verify(token, process.env.VICRED_JWT_SECRET!) as any;
    const cliente_id = payload?.cliente_id;

    const { data: cliente } = await supabase
      .from("clientes")
      .select("id, nombre, dni, vicred_id, telefono")
      .eq("id", cliente_id)
      .maybeSingle();

    if (!cliente) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: estado } = await supabase
      .from("vw_estado_credito")
      .select("*")
      .eq("cliente_id", cliente_id)
      .maybeSingle();

    const { data: cuotas } = await supabase
      .from("cuotas")
      .select("id, nro_cuota, vencimiento, monto, estado")
      .eq("cliente_id", cliente_id)
      .in("estado", ["pendiente", "vencida"])
      .order("vencimiento", { ascending: true })
      .limit(20);

    return NextResponse.json({ cliente, estado, cuotas: cuotas ?? [] });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}
