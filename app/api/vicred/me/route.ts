export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

export async function GET() {
  try {
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

    const supabase = createClient(url, key);

    // buscamos el cliente por DNI (porque eso guardamos en el token)
    const dni = String(payload?.dni || "").replace(/\D/g, "");
    if (!dni) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: cliente, error: errCliente } = await supabase
      .from("clientes")
      .select("*")
      .eq("dni", dni)
      .single();

    if (errCliente || !cliente) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Por ahora devolvemos "estado" y "cuotas" vacíos si aún no están armados
    // (después lo conectamos a tus tablas reales)
    return NextResponse.json({
      cliente,
      estado: {},
      cuotas: [],
    });
  } catch (e) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}