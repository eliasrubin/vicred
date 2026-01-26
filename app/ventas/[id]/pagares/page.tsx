"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

type Cliente = {
  id: string;
  nombre: string;
  dni: string | null;
  telefono?: string | null;
  direccion?: string | null;
};

type Venta = {
  id: string;
  fecha: string;
  factura_numero: string | null;
  total: number;
  cliente_id: string;
  comercio_id: number;
};

type Comercio = {
  id: number;
  codigo: string | null;
  nombre: string;
};

type Cuota = {
  id: string;
  nro: number;
  vencimiento: string; // yyyy-mm-dd
  importe: number;
  pagado: number;
  estado: string;
};

type Pagare = {
  id: string;
  venta_id: string;
  cuota_id: string;
  cliente_id: string;
  comercio_codigo: string;
  factura_numero: string | null;
  nro_paregare: number;
  monto: number;
  vencimiento: string; // date
  lugar_pago: string | null;
  created_at: string;
};

export default function PagaresVentaPage() {
  const { id } = useParams<{ id: string }>(); // ventaId
  const router = useRouter();
  const sp = useSearchParams();

  const [venta, setVenta] = useState<Venta | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [comercio, setComercio] = useState<Comercio | null>(null);

  const [pagares, setPagares] = useState<Pagare[]>([]);
  const [cuotas, setCuotas] = useState<Cuota[]>([]);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      // Venta
      const { data: v, error: vErr } = await supabase
        .from("ventas_credito")
        .select("id,fecha,factura_numero,total,cliente_id,comercio_id")
        .eq("id", id)
        .single();

      if (vErr) throw vErr;
      setVenta(v as any);

      // Cliente
      const { data: c, error: cErr } = await supabase
        .from("clientes")
        .select("id,nombre,dni,telefono,direccion")
        .eq("id", (v as any).cliente_id)
        .single();

      if (cErr) throw cErr;
      setCliente(c as any);

      // Comercio
      const { data: co, error: coErr } = await supabase
        .from("comercios")
        .select("id,codigo,nombre")
        .eq("id", (v as any).comercio_id)
        .single();

      if (coErr) throw coErr;
      setComercio(co as any);

      // Cuotas de la venta (por si querés comparar / usar datos)
      const { data: q, error: qErr } = await supabase
        .from("cuotas")
        .select("id,nro,vencimiento,importe,pagado,estado")
        .eq("venta_id", id)
        .order("nro", { ascending: true });

      if (qErr) throw qErr;
      setCuotas((q as any) || []);

      // Pagarés generados en DB
      const { data: p, error: pErr } = await supabase
        .from("pagares")
        .select("id,venta_id,cuota_id,cliente_id,comercio_codigo,factura_numero,nro_paregare,monto,vencimiento,lugar_pago,created_at")
        .eq("venta_id", id)
        .order("nro_paregare", { ascending: true });

      if (pErr) throw pErr;
      setPagares((p as any) || []);

      // auto print
      if (sp.get("print") === "1") {
        setTimeout(() => window.print(), 400);
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const titulo = useMemo(() => {
    const cod = comercio?.codigo ?? "";
    if (cod === "PCGAME") return "PCGAME";
    if (cod === "VIMODA") return "VIMODA";
    return comercio?.nombre ?? "Comercio";
  }, [comercio]);

  const facturaTxt = useMemo(() => {
    if (!venta) return "-";
    return venta.factura_numero ? `Factura ${venta.factura_numero}` : `Venta ${venta.id.slice(0, 8)}`;
  }, [venta]);

  const lugarPago = (pagares[0]?.lugar_pago ?? "Victorica, La Pampa") || "Victorica, La Pampa";

  const formatMoney = (n: any) => `$${Number(n ?? 0).toFixed(2)}`;

  if (loading && !venta) {
    return (
      <main style={{ maxWidth: 900, margin: "30px auto", fontFamily: "system-ui" }}>
        <p>Cargando pagarés...</p>
      </main>
    );
  }

  if (err) {
    return (
      <main style={{ maxWidth: 900, margin: "30px auto", fontFamily: "system-ui" }}>
        <button onClick={() => router.back()}>← Volver</button>
        <p style={{ color: "crimson", marginTop: 12 }}>{err}</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: "30px auto", fontFamily: "system-ui" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          main { margin: 0 !important; max-width: none !important; }
          .page-break { page-break-after: always; }
        }
      `}</style>

      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => router.back()}>← Volver</button>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => window.print()} disabled={pagares.length === 0}>
            Imprimir / Guardar PDF
          </button>
          <button onClick={load} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>

      <div className="no-print" style={{ marginTop: 12, opacity: 0.85 }}>
        <b>{titulo}</b> · {facturaTxt} · Cliente: <b>{cliente?.nombre ?? "-"}</b> · Cantidad de pagarés: <b>{pagares.length}</b>
        {pagares.length === 0 ? (
          <div style={{ marginTop: 8, color: "crimson" }}>
            No hay pagarés para esta venta. (Revisar que se haya ejecutado la generación en DB)
          </div>
        ) : null}
      </div>

      {/* Render pagarés */}
      {pagares.map((p, idx) => {
        const cuota = cuotas.find((q) => q.id === p.cuota_id);
        const nroCuota = cuota?.nro ?? p.nro_paregare;

        return (
          <section
            key={p.id}
            style={{
              border: "1px solid #eaeaea",
              borderRadius: 14,
              padding: 18,
              marginTop: 14,
            }}
            className={idx < pagares.length - 1 ? "page-break" : ""}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>PAGARÉ</div>
                <h2 style={{ margin: "4px 0 0 0" }}>{titulo}</h2>
                <div style={{ marginTop: 6, fontWeight: 700 }}>{facturaTxt}</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, opacity: 0.75 }}>N° pagaré</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>
                  {String(p.nro_paregare).padStart(2, "0")}/{String(pagares.length).padStart(2, "0")}
                </div>

                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>Vencimiento</div>
                <div style={{ fontWeight: 800 }}>{p.vencimiento}</div>

                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>Importe</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{formatMoney(p.monto)}</div>
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "14px 0" }} />

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Deudor</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{cliente?.nombre ?? "-"}</div>
                <div style={{ marginTop: 4, opacity: 0.9 }}>DNI: {cliente?.dni ?? "-"}</div>
                {cliente?.telefono ? <div style={{ opacity: 0.9 }}>Tel: {cliente.telefono}</div> : null}
                {cliente?.direccion ? <div style={{ opacity: 0.9 }}>Domicilio: {cliente.direccion}</div> : null}
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Condiciones</div>
                <div style={{ opacity: 0.9 }}>Lugar de pago: <b>{lugarPago}</b></div>
                <div style={{ opacity: 0.9 }}>Cuota asociada: <b>{nroCuota}</b></div>
                <div style={{ opacity: 0.9 }}>Comprobante interno: <b>{p.id.slice(0, 8).toUpperCase()}</b></div>
              </div>
            </div>

            <div style={{ marginTop: 16, lineHeight: 1.6, fontSize: 14 }}>
              <b>PAGARÉ:</b> Por el presente, debo y pagaré sin protesto a la orden de <b>{titulo}</b>, en la ciudad de{" "}
              <b>{lugarPago}</b>, la suma de <b>{formatMoney(p.monto)}</b> (pesos argentinos), el día <b>{p.vencimiento}</b>,
              correspondiente a <b>{facturaTxt}</b>.
              <br />
              <br />
              El presente pagaré se rige por las disposiciones aplicables del Código Civil y Comercial de la Nación y demás normas
              vigentes. A todos los efectos, el deudor constituye domicilio en el indicado precedentemente.
            </div>

            <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Firma del deudor</div>
                <div style={lineaFirma} />
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Aclaración</div>
                <div style={lineaFirma} />
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>DNI</div>
                <div style={lineaFirma} />
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Lugar y fecha de firma</div>
                <div style={lineaFirma} />
              </div>
            </div>

            <div style={{ marginTop: 14, fontSize: 11, opacity: 0.7 }}>
              Documento interno generado por el sistema de créditos. Conserve este pagaré para su control.
            </div>
          </section>
        );
      })}
    </main>
  );
}

const lineaFirma: React.CSSProperties = {
  marginTop: 8,
  borderBottom: "2px solid #111",
  height: 28,
};
