import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { getCommercialSession } from "@/lib/commercial/session";
import {
  getCatalogProductsBySourceIds,
  type ProductListItem,
} from "@/lib/catalog";

export type ReorderCandidate = ProductListItem & {
  lastOrderedAt: string;
  timesOrdered: number;
};

export type DashboardRecommendations = {
  reorder: ReorderCandidate[];
  habitual: ProductListItem[];
  recommended: ProductListItem[];
  coldStart: boolean;
};

function daysAgoLabel(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000));
}

export { daysAgoLabel };

export async function getDashboardRecommendations(): Promise<DashboardRecommendations> {
  const session = await getCommercialSession();
  const empty = {
    reorder: [] as ReorderCandidate[],
    habitual: [] as ProductListItem[],
    recommended: [] as ProductListItem[],
    coldStart: true,
  };

  if (!session || session.claims.app_role !== "customer_user" || !session.claims.customer_id) {
    const { getTangoProducts } = await import("@/lib/commercial/products-tango");
    const featured = await getTangoProducts({}, { limit: 8 });
    return { ...empty, recommended: featured };
  }

  const customerId = session.claims.customer_id;
  const supabase = await createCommercialServerClient();

  const [{ data: top }, { data: reorderRows }, { data: pairs }] = await Promise.all([
    supabase
      .from("v_client_top_products")
      .select("cod_articulo, veces, unidades, ultima_compra")
      .eq("customer_id", customerId)
      .order("unidades", { ascending: false })
      .limit(20),
    supabase
      .from("v_client_reorder")
      .select("cod_articulo, compras, ultima, due_for_reorder")
      .eq("customer_id", customerId)
      .eq("due_for_reorder", true)
      .order("ultima", { ascending: true })
      .limit(20),
    supabase
      .from("v_customer_product_pairs")
      .select("product_a, product_b, juntos")
      .eq("customer_id", customerId)
      .order("juntos", { ascending: false })
      .limit(40),
  ]);

  const topRows = (top ?? []).filter((r) => r.cod_articulo);
  const dueReorder = (reorderRows ?? []).filter((r) => r.cod_articulo);

  if (!topRows.length && !dueReorder.length) {
    const { getTangoProducts } = await import("@/lib/commercial/products-tango");
    const featured = await getTangoProducts({}, { limit: 8 });
    return { ...empty, recommended: featured, coldStart: true };
  }

  const habitualIds = topRows.map((r) => r.cod_articulo as string).slice(0, 12);
  const reorderIds = dueReorder.map((r) => r.cod_articulo as string).slice(0, 12);

  const owned = new Set(habitualIds);
  const togetherScore = new Map<string, number>();
  for (const p of pairs ?? []) {
    if (p.product_a && owned.has(p.product_a) && p.product_b && !owned.has(p.product_b)) {
      togetherScore.set(
        p.product_b,
        (togetherScore.get(p.product_b) ?? 0) + Number(p.juntos ?? 0),
      );
    }
    if (p.product_b && owned.has(p.product_b) && p.product_a && !owned.has(p.product_a)) {
      togetherScore.set(
        p.product_a,
        (togetherScore.get(p.product_a) ?? 0) + Number(p.juntos ?? 0),
      );
    }
  }
  const togetherIds = [...togetherScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, 8);

  const needed = [...new Set([...reorderIds, ...habitualIds, ...togetherIds])];
  const { getTangoProductsByCodes } = await import("@/lib/commercial/products-tango");
  const [catalogProducts, tangoProducts] = await Promise.all([
    getCatalogProductsBySourceIds(needed),
    getTangoProductsByCodes(needed),
  ]);
  const bySource = new Map<string, ProductListItem>();
  for (const p of catalogProducts) bySource.set(p.source_id, p);
  for (const p of tangoProducts) bySource.set(p.source_id, p);

  const topById = new Map(topRows.map((r) => [r.cod_articulo as string, r]));
  const reorderMeta = new Map(dueReorder.map((r) => [r.cod_articulo as string, r]));

  const reorder: ReorderCandidate[] = reorderIds
    .map((id) => {
      const product = bySource.get(id);
      const meta = reorderMeta.get(id) ?? topById.get(id);
      if (!product || !meta) return null;
      const last =
        "ultima" in meta && meta.ultima
          ? String(meta.ultima)
          : meta && "ultima_compra" in meta && meta.ultima_compra
            ? String(meta.ultima_compra)
            : null;
      if (!last) return null;
      return {
        ...product,
        lastOrderedAt: last.includes("T") ? last : `${last}T12:00:00.000Z`,
        timesOrdered: Number(
          ("compras" in meta ? meta.compras : null) ??
            ("veces" in meta ? meta.veces : null) ??
            0,
        ),
      };
    })
    .filter((x): x is ReorderCandidate => Boolean(x));

  const habitual = habitualIds
    .map((id) => bySource.get(id))
    .filter((p): p is ProductListItem => Boolean(p));

  let recommended = togetherIds
    .map((id) => bySource.get(id))
    .filter((p): p is ProductListItem => Boolean(p));

  if (recommended.length < 4) {
    const { getTangoProducts } = await import("@/lib/commercial/products-tango");
    const featured = await getTangoProducts({}, { limit: 12 });
    const used = new Set([...habitual, ...recommended, ...reorder].map((p) => p.source_id));
    for (const p of featured) {
      if (!used.has(p.source_id)) {
        recommended.push(p);
        used.add(p.source_id);
      }
      if (recommended.length >= 8) break;
    }
  }

  return {
    reorder,
    habitual,
    recommended,
    coldStart: false,
  };
}

export async function getAlsoBoughtSourceIds(
  productSourceId: string,
  limit = 8,
): Promise<string[]> {
  const session = await getCommercialSession();
  if (!session?.claims.customer_id) return [];
  const supabase = await createCommercialServerClient();
  const { data } = await supabase
    .from("v_customer_product_pairs")
    .select("product_a, product_b, juntos")
    .eq("customer_id", session.claims.customer_id)
    .or(`product_a.eq.${productSourceId},product_b.eq.${productSourceId}`)
    .order("juntos", { ascending: false })
    .limit(limit);
  const ids: string[] = [];
  for (const row of data ?? []) {
    const other =
      row.product_a === productSourceId ? row.product_b : row.product_a;
    if (other && !ids.includes(other)) ids.push(other);
  }
  return ids;
}
