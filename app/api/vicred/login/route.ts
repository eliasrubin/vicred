export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.VICRED_JWT_SECRET;

function normalizeClave(input: string) {
  const digits = (input || "").replace(/\D/g, "");
  return digits.padStart(6, "0").slice(-6);
}

export async function POST(req: Request) {
  const isProd = process.env.NODE_ENV === "production";

  try {
    if (!url || !serviceKey) {
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

    const { dni, clave } = await req.json();

    const dniClean = String(dni || "").replace(/\D/g, "");
    const clave6 = normalizeClave(String(clave || ""));
    const vicred_id = `VC-${clave6}`;

    if (dniClean.length < 7 || clave6.length !== 6) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const supabase = createClient(url, serviceKey);

    const { data: cliente, error } = await supabase
      .from("clientes")
      .select("id, dni, vicred_id")
      .eq("dni", Number(dniClean))
      .eq("vicred_id", vicred_id)
      .maybeSingle();

    if (error || !cliente) {
      return NextResponse.json({ error: "Datos incorrectos" }, { status: 401 });
    }

    const token = jwt.sign({ cliente_id: cliente.id }, jwtSecret, { expiresIn: "7d" });

    const res = NextResponse.json({ ok: true });
    res.headers.set("Cache-Control", "no-store");

    res.cookies.set("vicred_session", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      domain: isProd ? ".vicred.com.ar" : undefined,
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (e) {
    if (!isProd) console.error("VICRED LOGIN ERROR", e);
    return NextResponse.json({ error: "No se pudo ingresar" }, { status: 500 });
  }
}
