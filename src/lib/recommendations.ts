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
    const featured = (await getTangoProducts()).slice(0, 8);
    return { ...empty, recommended: featured };
  }

  const customerId = session.claims.customer_id;
  const supabase = await createCommercialServerClient();

  const { data: freq, error: freqErr } = await supabase
    .from("v_customer_product_frequency")
    .select(
      "product_source_id, veces_pedido, unidades_totales, ultima_vez, primera_vez",
    )
    .eq("customer_id", customerId);
  if (freqErr) throw new Error(freqErr.message);

  const rows = (freq ?? []).filter((r) => r.product_source_id);

  if (!rows.length) {
    const { getTangoProducts } = await import("@/lib/commercial/products-tango");
    const featured = (await getTangoProducts()).filter((p) => p.hasPrice).slice(0, 8);
    return { ...empty, recommended: featured, coldStart: true };
  }

  const now = Date.now();
  const reorderIds: string[] = [];
  const habitualSorted = [...rows].sort(
    (a, b) => Number(b.unidades_totales ?? 0) - Number(a.unidades_totales ?? 0),
  );
  const habitualIds = habitualSorted
    .map((r) => r.product_source_id as string)
    .slice(0, 12);

  for (const row of rows) {
    const veces = Number(row.veces_pedido ?? 0);
    if (veces < 2 || !row.ultima_vez || !row.primera_vez) continue;
    const ultima = new Date(row.ultima_vez).getTime();
    const primera = new Date(row.primera_vez).getTime();
    if (!Number.isFinite(ultima) || !Number.isFinite(primera) || ultima <= primera) continue;
    const avgMs = (ultima - primera) / (veces - 1);
    if (now - ultima >= avgMs) {
      reorderIds.push(row.product_source_id as string);
    }
  }

  const { data: pairs } = await supabase
    .from("v_customer_product_pairs")
    .select("product_a, product_b, juntos")
    .eq("customer_id", customerId)
    .order("juntos", { ascending: false })
    .limit(40);

  const owned = new Set(rows.map((r) => r.product_source_id as string));
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

  const freqById = new Map(rows.map((r) => [r.product_source_id as string, r]));

  const reorder: ReorderCandidate[] = reorderIds
    .map((id) => {
      const product = bySource.get(id);
      const meta = freqById.get(id);
      if (!product || !meta?.ultima_vez) return null;
      return {
        ...product,
        lastOrderedAt: meta.ultima_vez,
        timesOrdered: Number(meta.veces_pedido ?? 0),
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
    const featured = (await getTangoProducts()).filter((p) => p.hasPrice).slice(0, 12);
    const used = new Set([...habitual, ...recommended].map((p) => p.source_id));
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
