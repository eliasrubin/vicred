export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeClave(input: string) {
  const digits = input.replace(/\D/g, "");
  return digits.padStart(6, "0").slice(-6);
}

export async function POST(req: Request) {
  const { dni, clave } = await req.json();

  const dniClean = String(dni || "").replace(/\D/g, "");
  const clave6 = normalizeClave(String(clave || ""));
  const vicred_id = `VC-${clave6}`;

  const { data: cliente, error } = await supabase
  .from("clientes")
  .select("id, dni, vicred_id")
  .eq("dni", dniClean)
  .eq("vicred_id", vicred_id)
  .maybeSingle();

console.log("LOGIN DEBUG", {
  dniClean,
  vicred_id,
  cliente,
  error,
});


  if (error || !cliente) {
    return NextResponse.json({ error: "Datos incorrectos" }, { status: 401 });
  }

  const token = jwt.sign(
    { cliente_id: cliente.id },
    process.env.VICRED_JWT_SECRET!,
    { expiresIn: "7d" }
  );

  const res = NextResponse.json({ ok: true });
  res.cookies.set("vicred_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
