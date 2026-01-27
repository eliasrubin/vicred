export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeClave(input: string) {
  const digits = (input || "").replace(/\D/g, "");
  return digits.padStart(6, "0").slice(-6);
}

export async function POST(req: Request) {
  const isProd = process.env.NODE_ENV === "production";

  try {
    const { dni, clave } = await req.json();

    const dniClean = String(dni || "").replace(/\D/g, "");
    const clave6 = normalizeClave(String(clave || ""));
    const vicred_id = `VC-${clave6}`;

    if (dniClean.length < 7 || clave6.length !== 6) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { data: cliente, error } = await supabase
      .from("clientes")
      .select("id, dni, vicred_id")
      .eq("dni", Number(dniClean)) // más robusto si dni es numérico
      .eq("vicred_id", vicred_id)
      .maybeSingle();

    // Debug solo en local (evita ensuciar logs en producción)
    if (!isProd) {
      console.log("LOGIN DEBUG", {
        dni_input: dni,
        dniClean,
        clave_input: clave,
        clave6,
        vicred_id,
        cliente,
        error,
      });
    }

    if (error || !cliente) {
      return NextResponse.json({ error: "Datos incorrectos" }, { status: 401 });
    }

    const token = jwt.sign(
      { cliente_id: cliente.id },
      process.env.VICRED_JWT_SECRET!,
      { expiresIn: "7d" }
    );

    const res = NextResponse.json({ ok: true });

    // Cookie válida para www.vicred.com.ar y vicred.com.ar
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
