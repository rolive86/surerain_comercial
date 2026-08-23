import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { getCommercialSession } from "@/lib/commercial/session";
import { requireStaffSession } from "@/lib/commercial/backoffice";

export type SalesComprobante = {
  nro_comprobante: string;
  tipo_comprobante: string | null;
  fecha: string | null;
  total_signed: number;
  line_count: number;
};

export type SalesLine = {
  id: string;
  nro_comprobante: string | null;
  tipo_comprobante: string | null;
  fecha: string | null;
  cod_articulo: string | null;
  cantidad: number | null;
  total_facturado: number | null;
};

export type SalesSummary = {
  comprobantes: number;
  total_facturado: number;
  total_12m: number;
  ultima_compra: string | null;
  primera_compra: string | null;
};

export type TopProduct = {
  cod_articulo: string;
  veces: number;
  unidades: number;
  ultima_compra: string | null;
};

function signedTotal(tipo: string | null | undefined, total: number | null): number {
  const t = Number(total ?? 0);
  if (tipo && tipo.toUpperCase().startsWith("NC")) return -Math.abs(t);
  return t;
}

export async function getStaffCustomerSales(customerId: string): Promise<{
  summary: SalesSummary | null;
  comprobantes: SalesComprobante[];
  topProducts: TopProduct[];
}> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();

  const [{ data: summary }, { data: lines, error }, { data: top }] = await Promise.all([
    supabase
      .from("v_client_sales_summary")
      .select(
        "comprobantes, total_facturado, total_12m, ultima_compra, primera_compra",
      )
      .eq("customer_id", customerId)
      .maybeSingle(),
    supabase
      .from("sales_history")
      .select(
        "nro_comprobante, tipo_comprobante, fecha, total_facturado, cod_articulo",
      )
      .eq("customer_id", customerId)
      .order("fecha", { ascending: false })
      .limit(2000),
    supabase
      .from("v_client_top_products")
      .select("cod_articulo, veces, unidades, ultima_compra")
      .eq("customer_id", customerId)
      .order("unidades", { ascending: false })
      .limit(15),
  ]);
  if (error) throw new Error(error.message);

  const byNro = new Map<string, SalesComprobante>();
  for (const row of lines ?? []) {
    const nro = row.nro_comprobante || "—";
    const existing = byNro.get(nro);
    const add = signedTotal(row.tipo_comprobante, row.total_facturado);
    if (existing) {
      existing.total_signed += add;
      existing.line_count += 1;
    } else {
      byNro.set(nro, {
        nro_comprobante: nro,
        tipo_comprobante: row.tipo_comprobante,
        fecha: row.fecha,
        total_signed: add,
        line_count: 1,
      });
    }
  }

  const comprobantes = [...byNro.values()].sort((a, b) => {
    const da = a.fecha ? new Date(a.fecha).getTime() : 0;
    const db = b.fecha ? new Date(b.fecha).getTime() : 0;
    return db - da;
  });

  return {
    summary: summary
      ? {
          comprobantes: Number(summary.comprobantes ?? 0),
          total_facturado: Number(summary.total_facturado ?? 0),
          total_12m: Number(summary.total_12m ?? 0),
          ultima_compra: summary.ultima_compra,
          primera_compra: summary.primera_compra,
        }
      : null,
    comprobantes: comprobantes.slice(0, 100),
    topProducts: (top ?? [])
      .filter((t): t is typeof t & { cod_articulo: string } => Boolean(t.cod_articulo))
      .map((t) => ({
        cod_articulo: t.cod_articulo,
        veces: Number(t.veces ?? 0),
        unidades: Number(t.unidades ?? 0),
        ultima_compra: t.ultima_compra,
      })),
  };
}

export async function listCustomerSalesHistory(): Promise<{
  comprobantes: Array<{
    nro_comprobante: string;
    tipo_comprobante: string | null;
    fecha: string | null;
    lines: Array<{
      cod_articulo: string;
      cantidad: number;
    }>;
  }>;
}> {
  const session = await getCommercialSession();
  if (!session || session.claims.app_role !== "customer_user" || !session.claims.customer_id) {
    throw new Error("CUSTOMER_ROLE_REQUIRED");
  }
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("sales_history")
    .select("nro_comprobante, tipo_comprobante, fecha, cod_articulo, cantidad")
    .eq("customer_id", session.claims.customer_id)
    .order("fecha", { ascending: false })
    .limit(1500);
  if (error) throw new Error(error.message);

  const byNro = new Map<
    string,
    {
      nro_comprobante: string;
      tipo_comprobante: string | null;
      fecha: string | null;
      lines: Array<{ cod_articulo: string; cantidad: number }>;
    }
  >();

  for (const row of data ?? []) {
    const nro = row.nro_comprobante || "—";
    const art = row.cod_articulo;
    if (!art) continue;
    const qty = Number(row.cantidad ?? 0);
    const existing = byNro.get(nro);
    if (existing) {
      existing.lines.push({ cod_articulo: art, cantidad: qty });
    } else {
      byNro.set(nro, {
        nro_comprobante: nro,
        tipo_comprobante: row.tipo_comprobante,
        fecha: row.fecha,
        lines: [{ cod_articulo: art, cantidad: qty }],
      });
    }
  }

  return {
    comprobantes: [...byNro.values()].slice(0, 80),
  };
}
