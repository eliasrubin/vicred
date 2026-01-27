export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

function normalizeClave(input: string) {
  const digits = (input || "").replace(/\D/g, "");
  return digits.padStart(6, "0").slice(-6);
}

export async function POST(req: Request) {
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

    const supabase = createClient(url, key);

    const isProd = process.env.NODE_ENV === "production";
    const { dni, clave } = await req.json();

    if (!dni || !clave) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const claveNormalizada = normalizeClave(clave);

    const { data, error } = await supabase
      .from("clientes")
      .select("id, dni, clave")
      .eq("dni", dni)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 401 });
    }

    if (data.clave !== claveNormalizada) {
      return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });
    }

    const token = jwt.sign({ id: data.id, dni: data.dni }, jwtSecret, {
      expiresIn: "7d",
    });

    const res = NextResponse.json({ token });

    res.cookies.set("auth", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      domain: isProd ? ".vicred.com.ar" : undefined,
    });

    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
