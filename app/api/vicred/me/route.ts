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

  const token = cookies().get("auth")?.value;
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

  const { data: cliente, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("dni", dni)
    .single();

  if (error || !cliente) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return NextResponse.json({
    cliente,
    estado: {},
    cuotas: [],
  });
}
