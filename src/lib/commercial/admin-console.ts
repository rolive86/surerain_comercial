import "server-only";

import { createCommercialAdminClient } from "@/lib/supabase/commercial/admin";
import { getCommercialSession } from "@/lib/commercial/session";
import { requireAdminConsoleSession } from "@/lib/commercial/backoffice";
import type { Json } from "@/types/commercial.types";

export type MarginRow = {
  id: string;
  scope: string;
  category: string | null;
  cod_articulo: string | null;
  customer_id: string | null;
  customer_name: string | null;
  percent: number;
  active: boolean;
  updated_at: string;
};

export type PriceRow = {
  cod_articulo: string;
  descripcion: string | null;
  categoria: string | null;
  base: number | null;
  margin_percent: number | null;
  final: number | null;
  mapped: boolean;
  source_id: string | null;
};

function pickMarginPercent(
  cod: string,
  category: string | null,
  margins: Array<{ scope: string; category: string | null; cod_articulo: string | null; percent: number; active: boolean; customer_id: string | null }>,
): number | null {
  const active = margins.filter((m) => m.active && m.customer_id == null);
  const product = active.find((m) => m.scope === "product" && m.cod_articulo === cod);
  if (product) return Number(product.percent);
  const cat = category
    ? active.find((m) => m.scope === "category" && m.category === category)
    : undefined;
  if (cat) return Number(cat.percent);
  const global = active.find((m) => m.scope === "global");
  return global ? Number(global.percent) : null;
}

export async function listMargins(): Promise<MarginRow[]> {
  const session = await getCommercialSession();
  requireAdminConsoleSession(session);
  const supabase = createCommercialAdminClient();
  const { data, error } = await supabase
    .from("margins")
    .select("id, scope, category, cod_articulo, customer_id, percent, active, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const customerIds = [...new Set((data ?? []).map((m) => m.customer_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (customerIds.length) {
    const { data: customers } = await supabase
      .from("customers")
      .select("id, legal_name, trade_name")
      .in("id", customerIds);
    for (const c of customers ?? []) {
      names.set(c.id, c.trade_name || c.legal_name);
    }
  }

  return (data ?? []).map((m) => ({
    ...m,
    percent: Number(m.percent),
    customer_name: m.customer_id ? names.get(m.customer_id) ?? m.customer_id : null,
  }));
}

export async function listCustomersBrief() {
  const session = await getCommercialSession();
  requireAdminConsoleSession(session);
  const supabase = createCommercialAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, legal_name, trade_name")
    .eq("active", true)
    .order("legal_name")
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listAdminPrices(opts: {
  q?: string;
  category?: string;
}): Promise<{ rows: PriceRow[]; categories: string[]; tangoPriceCount: number }> {
  const session = await getCommercialSession();
  requireAdminConsoleSession(session);
  const supabase = createCommercialAdminClient();

  const [{ data: prices, error: pErr }, { data: eff, error: eErr }, { data: maps, error: mErr }, { data: margins, error: gErr }, { data: specsJson }] =
    await Promise.all([
      supabase.from("prices").select("product_source_id, amount"),
      supabase.from("effective_prices").select("cod_articulo, final_amount, customer_id").is("customer_id", null),
      supabase.from("product_map").select("source_id, cod_articulo, tango_desc, catalog_name"),
      supabase.from("margins").select("scope, category, cod_articulo, percent, active, customer_id"),
      supabase.rpc("tango_staging_fetch", { p_entity: "articulos_specs" }),
    ]);
  if (pErr) throw new Error(pErr.message);
  if (eErr) throw new Error(eErr.message);
  if (mErr) throw new Error(mErr.message);
  if (gErr) throw new Error(gErr.message);

  const specs = Array.isArray(specsJson) ? (specsJson as Json[]) : [];
  const specByCode = new Map<string, { categoria: string | null; descripcion: string | null }>();
  for (const raw of specs) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const cod = String(r.cod_articulo ?? "").trim();
    if (!cod) continue;
    specByCode.set(cod, {
      categoria: r.categoria ? String(r.categoria) : null,
      descripcion: r.descripcion ? String(r.descripcion) : null,
    });
  }

  const baseBy = new Map((prices ?? []).map((p) => [p.product_source_id, Number(p.amount)]));
  const finalBy = new Map((eff ?? []).map((p) => [p.cod_articulo, Number(p.final_amount)]));
  const mapByCode = new Map((maps ?? []).map((m) => [m.cod_articulo, m]));

  const codes = new Set<string>([
    ...baseBy.keys(),
    ...finalBy.keys(),
    ...mapByCode.keys(),
    ...specByCode.keys(),
  ]);

  const categories = [...new Set([...specByCode.values()].map((s) => s.categoria).filter(Boolean))] as string[];
  categories.sort((a, b) => a.localeCompare(b, "es"));

  const q = opts.q?.trim().toLowerCase() ?? "";
  const cat = opts.category?.trim() ?? "";

  const rows: PriceRow[] = [];
  for (const cod of codes) {
    const spec = specByCode.get(cod);
    const mapped = mapByCode.get(cod);
    const descripcion = mapped?.tango_desc || spec?.descripcion || mapped?.catalog_name || null;
    const categoria = spec?.categoria ?? mapped?.tango_desc ?? null;
    if (cat && categoria !== cat) continue;
    if (q) {
      const hay = `${cod} ${descripcion ?? ""} ${mapped?.source_id ?? ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    const base = baseBy.get(cod) ?? null;
    const categoryForMargin = mapped?.tango_desc ?? categoria;
    const margin_percent = pickMarginPercent(cod, categoryForMargin, margins ?? []);
    rows.push({
      cod_articulo: cod,
      descripcion,
      categoria,
      base,
      margin_percent,
      final: finalBy.get(cod) ?? null,
      mapped: Boolean(mapped),
      source_id: mapped?.source_id ?? null,
    });
  }

  rows.sort((a, b) => {
    const ap = a.base == null ? 1 : 0;
    const bp = b.base == null ? 1 : 0;
    if (ap !== bp) return ap - bp;
    return a.cod_articulo.localeCompare(b.cod_articulo);
  });

  return { rows: rows.slice(0, 500), categories, tangoPriceCount: baseBy.size };
}

export async function listTangoArticles(): Promise<Array<{ cod_articulo: string; descripcion: string | null }>> {
  const session = await getCommercialSession();
  requireAdminConsoleSession(session);
  const supabase = createCommercialAdminClient();
  const [{ data: arts }, { data: specs }] = await Promise.all([
    supabase.rpc("tango_staging_fetch", { p_entity: "articulos" }),
    supabase.rpc("tango_staging_fetch", { p_entity: "articulos_specs" }),
  ]);
  const out = new Map<string, string | null>();
  for (const raw of [...(Array.isArray(arts) ? arts : []), ...(Array.isArray(specs) ? specs : [])]) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const cod = String(r.cod_articulo ?? "").trim();
    if (!cod) continue;
    const desc = r.descripcion ? String(r.descripcion) : null;
    if (!out.has(cod) || desc) out.set(cod, desc);
  }
  return [...out.entries()]
    .map(([cod_articulo, descripcion]) => ({ cod_articulo, descripcion }))
    .sort((a, b) => a.cod_articulo.localeCompare(b.cod_articulo));
}

export async function listAdminMetrics() {
  const session = await getCommercialSession();
  requireAdminConsoleSession(session);
  const supabase = createCommercialAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: statuses },
    { count: orders30 },
    { count: customers },
    { count: reps },
    { data: topItems },
  ] = await Promise.all([
    supabase.from("orders").select("status"),
    supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", since),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("active", true),
    supabase.from("sales_reps").select("*", { count: "exact", head: true }).eq("active", true),
    supabase.from("order_items").select("product_source_id, product_name_snapshot, quantity"),
  ]);

  const byStatus = new Map<string, number>();
  for (const o of statuses ?? []) {
    byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1);
  }

  const topMap = new Map<string, { name: string; qty: number }>();
  for (const i of topItems ?? []) {
    const cur = topMap.get(i.product_source_id) ?? {
      name: i.product_name_snapshot,
      qty: 0,
    };
    cur.qty += Number(i.quantity);
    topMap.set(i.product_source_id, cur);
  }
  const top = [...topMap.entries()]
    .map(([source_id, v]) => ({ source_id, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  const { data: statusLabels } = await supabase
    .from("order_statuses")
    .select("code, label")
    .order("sort_order");

  return {
    byStatus: (statusLabels ?? []).map((s) => ({
      code: s.code,
      label: s.label,
      count: byStatus.get(s.code) ?? 0,
    })),
    orders30: orders30 ?? 0,
    customersActive: customers ?? 0,
    repsActive: reps ?? 0,
    topProducts: top,
  };
}

export async function listProductMaps() {
  const session = await getCommercialSession();
  requireAdminConsoleSession(session);
  const supabase = createCommercialAdminClient();
  const { data, error } = await supabase
    .from("product_map")
    .select("source_id, cod_articulo, catalog_name, tango_desc, match_method, confidence, confirmed")
    .order("confirmed")
    .order("confidence", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
