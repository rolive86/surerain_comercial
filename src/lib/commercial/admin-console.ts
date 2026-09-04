import "server-only";

import { createCommercialAdminClient } from "@/lib/supabase/commercial/admin";
import { getCommercialSession } from "@/lib/commercial/session";
import { requireAdminConsoleSession } from "@/lib/commercial/backoffice";
import type { Json } from "@/types/commercial.types";
import type { MarginPreview } from "@/lib/commercial/admin-types";

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
  applied_rule: string;
};

type MarginLite = {
  id?: string;
  scope: string;
  category: string | null;
  cod_articulo: string | null;
  percent: number;
  active: boolean;
  customer_id: string | null;
};

function articleFamily(familia: string | null | undefined, specCat: string | null | undefined): string | null {
  const f = familia?.trim();
  if (f) return f;
  const c = specCat?.trim();
  return c || null;
}

function pickAppliedMargin(
  cod: string,
  family: string | null,
  margins: MarginLite[],
): MarginLite | null {
  const active = margins.filter((m) => m.active && m.customer_id == null);
  const product = active.find((m) => m.scope === "product" && m.cod_articulo === cod);
  if (product) return product;
  const cat =
    family ? active.find((m) => m.scope === "category" && m.category === family) : undefined;
  if (cat) return cat;
  const global = active.find((m) => m.scope === "global");
  return global ?? null;
}

function appliedRuleLabel(rule: MarginLite | null, family: string | null): string {
  if (!rule) return "sin regla";
  if (rule.scope === "product") return `producto ${rule.cod_articulo}`;
  if (rule.scope === "category") return `categoría ${rule.category ?? family ?? ""}`.trim();
  if (rule.scope === "global") return "global";
  return rule.scope;
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

  const [{ data: prices, error: pErr }, { data: eff, error: eErr }, { data: maps, error: mErr }, { data: margins, error: gErr }, { data: specsJson }, { data: artsJson }] =
    await Promise.all([
      supabase.from("prices").select("product_source_id, amount"),
      supabase.from("effective_prices").select("cod_articulo, final_amount, customer_id").is("customer_id", null),
      supabase.from("product_map").select("source_id, cod_articulo, tango_desc, catalog_name"),
      supabase.from("margins").select("id, scope, category, cod_articulo, percent, active, customer_id"),
      supabase.rpc("tango_staging_fetch", { p_entity: "articulos_specs" }),
      supabase.rpc("tango_staging_fetch", { p_entity: "articulos" }),
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

  const familiaByCode = new Map<string, string | null>();
  const arts = Array.isArray(artsJson) ? (artsJson as Json[]) : [];
  for (const raw of arts) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const cod = String(r.cod_articulo ?? "").trim();
    if (!cod) continue;
    familiaByCode.set(cod, r.familia ? String(r.familia) : null);
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

  const categories = [
    ...new Set(
      [...specByCode.entries()].map(([cod, s]) => articleFamily(familiaByCode.get(cod), s.categoria)),
    ),
  ].filter(Boolean) as string[];
  categories.sort((a, b) => a.localeCompare(b, "es"));

  const q = opts.q?.trim().toLowerCase() ?? "";
  const cat = opts.category?.trim() ?? "";

  const rows: PriceRow[] = [];
  for (const cod of codes) {
    const spec = specByCode.get(cod);
    const mapped = mapByCode.get(cod);
    const descripcion = mapped?.tango_desc || spec?.descripcion || mapped?.catalog_name || null;
    const familia = articleFamily(familiaByCode.get(cod), spec?.categoria ?? null);
    const categoria = familia;
    if (cat && categoria !== cat) continue;
    if (q) {
      const hay = `${cod} ${descripcion ?? ""} ${mapped?.source_id ?? ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    const base = baseBy.get(cod) ?? null;
    const rule = pickAppliedMargin(cod, familia, (margins ?? []) as MarginLite[]);
    const margin_percent = rule ? Number(rule.percent) : null;
    rows.push({
      cod_articulo: cod,
      descripcion,
      categoria,
      base,
      margin_percent,
      final: finalBy.get(cod) ?? null,
      mapped: Boolean(mapped),
      source_id: mapped?.source_id ?? null,
      applied_rule: appliedRuleLabel(rule, familia),
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

export async function listTangoFamilies(): Promise<string[]> {
  const session = await getCommercialSession();
  requireAdminConsoleSession(session);
  const supabase = createCommercialAdminClient();
  const [{ data: arts }, { data: specs }] = await Promise.all([
    supabase.rpc("tango_staging_fetch", { p_entity: "articulos" }),
    supabase.rpc("tango_staging_fetch", { p_entity: "articulos_specs" }),
  ]);
  const set = new Set<string>();
  for (const raw of Array.isArray(arts) ? (arts as Json[]) : []) {
    if (!raw || typeof raw !== "object") continue;
    const f = String((raw as Record<string, unknown>).familia ?? "").trim();
    if (f) set.add(f);
  }
  for (const raw of Array.isArray(specs) ? (specs as Json[]) : []) {
    if (!raw || typeof raw !== "object") continue;
    const f = String((raw as Record<string, unknown>).categoria ?? "").trim();
    if (f) set.add(f);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

export type { MarginPreview } from "@/lib/commercial/admin-types";

export async function previewMarginImpact(input: {
  id?: string | null;
  scope: string;
  percent: number;
  category?: string | null;
  cod_articulo?: string | null;
  customer_id?: string | null;
}): Promise<MarginPreview> {
  const session = await getCommercialSession();
  requireAdminConsoleSession(session);
  if (input.scope === "customer") {
    return {
      count: 0,
      examples: [],
      note: "El margen por cliente no entra en el listado general; se aplica al precio de ese cliente.",
    };
  }

  const supabase = createCommercialAdminClient();
  const [{ data: prices, error: pErr }, { data: maps }, { data: margins, error: gErr }, { data: specsJson }, { data: artsJson }] =
    await Promise.all([
      supabase.from("prices").select("product_source_id, amount"),
      supabase.from("product_map").select("cod_articulo, tango_desc, catalog_name"),
      supabase.from("margins").select("id, scope, category, cod_articulo, percent, active, customer_id"),
      supabase.rpc("tango_staging_fetch", { p_entity: "articulos_specs" }),
      supabase.rpc("tango_staging_fetch", { p_entity: "articulos" }),
    ]);
  if (pErr) throw new Error(pErr.message);
  if (gErr) throw new Error(gErr.message);

  const proposedId = input.id?.trim() || "__preview__";
  const proposed: MarginLite = {
    id: proposedId,
    scope: input.scope,
    category: input.scope === "category" ? input.category ?? null : null,
    cod_articulo: input.scope === "product" ? input.cod_articulo ?? null : null,
    percent: input.percent,
    active: true,
    customer_id: null,
  };

  const simulated: MarginLite[] = ((margins ?? []) as MarginLite[])
    .filter((m) => m.id !== proposedId)
    .concat(proposed);

  const specByCode = new Map<string, { categoria: string | null; descripcion: string | null }>();
  for (const raw of Array.isArray(specsJson) ? (specsJson as Json[]) : []) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const cod = String(r.cod_articulo ?? "").trim();
    if (!cod) continue;
    specByCode.set(cod, {
      categoria: r.categoria ? String(r.categoria) : null,
      descripcion: r.descripcion ? String(r.descripcion) : null,
    });
  }
  const familiaByCode = new Map<string, string | null>();
  for (const raw of Array.isArray(artsJson) ? (artsJson as Json[]) : []) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const cod = String(r.cod_articulo ?? "").trim();
    if (!cod) continue;
    familiaByCode.set(cod, r.familia ? String(r.familia) : null);
  }
  const descBy = new Map((maps ?? []).map((m) => [m.cod_articulo, m.tango_desc || m.catalog_name]));

  const hits: MarginPreview["examples"] = [];
  for (const p of prices ?? []) {
    const cod = p.product_source_id;
    const family = articleFamily(familiaByCode.get(cod), specByCode.get(cod)?.categoria ?? null);
    const rule = pickAppliedMargin(cod, family, simulated);
    if (!rule || rule.id !== proposedId) continue;
    const base = Number(p.amount);
    if (!Number.isFinite(base) || base <= 0) continue;
    hits.push({
      cod_articulo: cod,
      descripcion: descBy.get(cod) || specByCode.get(cod)?.descripcion || null,
      base,
      final: Math.round(base * (1 + input.percent / 100) * 100) / 100,
    });
  }

  return {
    count: hits.length,
    examples: hits.slice(0, 3),
    note: null,
  };
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
