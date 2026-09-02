import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import type { ProductListItem, ProductDetail } from "@/lib/catalog";
import { loadVariantIndex } from "@/lib/commercial/product-groups";

export type TangoProductFilters = {
  q?: string;
  familia?: string;
  /** "stock" | "confirmar" | undefined */
  disponibilidad?: string;
};

export type TangoProductRow = {
  cod_articulo: string;
  descripcion: string | null;
  familia: string | null;
  cod_barra: string | null;
  unidad: string | null;
  catalog_source_id: string | null;
  image_url: string | null;
  has_price: boolean;
  has_stock: boolean;
  stock_qty: number | null;
};

const SELECT_COLS =
  "cod_articulo, descripcion, familia, cod_barra, unidad, catalog_source_id, image_url, has_price, has_stock, stock_qty";

/** Supabase/PostgREST default page size; we page past it when needed. */
const REST_PAGE = 1000;

/** Slug/path segment for portal ficha: /catalogo/t/[code] */
export function tangoProductSlug(codArticulo: string): string {
  return `t/${encodeURIComponent(codArticulo)}`;
}

export function tangoProductHref(codArticulo: string): string {
  return `/catalogo/${tangoProductSlug(codArticulo)}`;
}

export function toListItem(row: TangoProductRow): ProductListItem {
  const name = row.descripcion?.trim() || row.cod_articulo;
  return {
    id: row.cod_articulo,
    source_id: row.cod_articulo,
    name,
    slug: tangoProductSlug(row.cod_articulo),
    short_description: null,
    brand_name: null,
    brand_slug: null,
    category_name: row.familia,
    category_slug: row.familia,
    type_name: null,
    type_slug: null,
    image: row.image_url
      ? {
          id: row.cod_articulo,
          alt_text: name,
          bucket: null,
          storage_path: null,
          url: row.image_url,
        }
      : null,
    tangoCode: row.cod_articulo,
    hasStock: row.has_stock,
    hasPrice: row.has_price,
    stockQty: row.stock_qty,
    variantCount: 1,
    isVariantGroup: false,
  };
}

function escapeIlike(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

type FilterableQuery = {
  eq: (col: string, val: unknown) => FilterableQuery;
  or: (filters: string) => FilterableQuery;
  order: (
    col: string,
    opts?: { ascending?: boolean; nullsFirst?: boolean },
  ) => FilterableQuery;
  range: (from: number, to: number) => FilterableQuery;
};

function applyFilters<T extends FilterableQuery>(
  query: T,
  filters: TangoProductFilters,
): T {
  let q = query;
  if (filters.familia) {
    q = q.eq("familia", filters.familia) as T;
  }
  if (filters.disponibilidad === "stock") {
    q = q.eq("has_stock", true) as T;
  } else if (filters.disponibilidad === "confirmar") {
    q = q.eq("has_price", false).eq("has_stock", true) as T;
  }
  const term = filters.q?.trim();
  if (term) {
    const safe = escapeIlike(term);
    q = q.or(
      `cod_articulo.ilike.%${safe}%,descripcion.ilike.%${safe}%,familia.ilike.%${safe}%`,
    ) as T;
  }
  return q;
}

/** Photos first (image_url not null), then description A→Z. */
function applyCatalogOrder<T extends FilterableQuery>(query: T): T {
  return query
    .order("image_url", { ascending: false, nullsFirst: false })
    .order("descripcion", { ascending: true, nullsFirst: false }) as T;
}

async function fetchAllMatchingRows(
  filters: TangoProductFilters,
): Promise<TangoProductRow[]> {
  const supabase = await createCommercialServerClient();
  const items: TangoProductRow[] = [];
  let from = 0;
  for (;;) {
    let query = supabase
      .from("products_tango")
      .select(SELECT_COLS)
      .eq("active", true);
    query = applyFilters(query as unknown as FilterableQuery, filters) as typeof query;
    query = applyCatalogOrder(query as unknown as FilterableQuery) as typeof query;
    const { data, error } = await query.range(from, from + REST_PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as TangoProductRow[];
    items.push(...rows);
    if (rows.length < REST_PAGE) break;
    from += REST_PAGE;
  }
  return items;
}

/**
 * Colapsa variantes: un card por grupo (si ≥2 en el resultado) + singles.
 * Si el filtro matchea una variante, el padre aparece igual.
 */
function collapseToCards(
  rows: TangoProductRow[],
  index: Awaited<ReturnType<typeof loadVariantIndex>>,
): ProductListItem[] {
  const { groupById, codeToGroupId } = index;
  const seenGroups = new Set<string>();
  const cards: ProductListItem[] = [];
  const groupMembers = new Map<string, TangoProductRow[]>();

  for (const row of rows) {
    const gid = codeToGroupId.get(row.cod_articulo);
    const meta = gid ? groupById.get(gid) : undefined;
    if (gid && meta && meta.variant_count > 1) {
      const list = groupMembers.get(gid) ?? [];
      list.push(row);
      groupMembers.set(gid, list);
      continue;
    }
    cards.push(toListItem(row));
  }

  for (const [gid, members] of groupMembers) {
    if (seenGroups.has(gid)) continue;
    seenGroups.add(gid);
    const meta = groupById.get(gid);
    if (!meta?.slug) {
      for (const m of members) cards.push(toListItem(m));
      continue;
    }
    const rep =
      members.find((m) => m.image_url) ??
      members.slice().sort((a, b) => a.cod_articulo.localeCompare(b.cod_articulo))[0];
    const hasStock = members.some((m) => m.has_stock);
    const hasPrice = members.some((m) => m.has_price);
    cards.push({
      id: `group:${gid}`,
      source_id: rep.cod_articulo,
      name: meta.name,
      slug: `g/${encodeURIComponent(meta.slug)}`,
      short_description: null,
      brand_name: null,
      brand_slug: null,
      category_name: meta.familia ?? rep.familia,
      category_slug: meta.familia ?? rep.familia,
      type_name: null,
      type_slug: null,
      image: rep.image_url
        ? {
            id: rep.cod_articulo,
            alt_text: meta.name,
            bucket: null,
            storage_path: null,
            url: rep.image_url,
          }
        : null,
      tangoCode: null,
      hasStock,
      hasPrice,
      stockQty: rep.stock_qty,
      variantCount: meta.variant_count,
      isVariantGroup: true,
    });
  }

  cards.sort((a, b) => {
    const ai = a.image?.url ? 0 : 1;
    const bi = b.image?.url ? 0 : 1;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name, "es");
  });

  return cards;
}

export async function getTangoFamilias(): Promise<Array<{ slug: string; name: string }>> {
  const supabase = await createCommercialServerClient();
  const set = new Set<string>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("products_tango")
      .select("familia")
      .eq("active", true)
      .not("familia", "is", null)
      .range(from, from + REST_PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const row of rows) {
      const f = row.familia?.trim();
      if (f) set.add(f);
    }
    if (rows.length < REST_PAGE) break;
    from += REST_PAGE;
  }
  return [...set]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((name) => ({ slug: name, name }));
}

export async function getTangoProductsPaged(
  filters: TangoProductFilters = {},
  page = 1,
  pageSize = 24,
): Promise<{ items: ProductListItem[]; total: number }> {
  const safePage = Math.max(1, page);
  const size = Math.max(1, Math.min(pageSize, 100));
  const [rows, index] = await Promise.all([
    fetchAllMatchingRows(filters),
    loadVariantIndex(),
  ]);
  const cards = collapseToCards(rows, index);
  const from = (safePage - 1) * size;
  return {
    items: cards.slice(from, from + size),
    total: cards.length,
  };
}

export async function getTangoProducts(
  filters: TangoProductFilters = {},
  opts?: { limit?: number },
): Promise<ProductListItem[]> {
  const [rows, index] = await Promise.all([
    fetchAllMatchingRows(filters),
    loadVariantIndex(),
  ]);
  const cards = collapseToCards(rows, index);
  if (opts?.limit) return cards.slice(0, opts.limit);
  return cards;
}

export async function getTangoProductByCode(
  codArticulo: string,
): Promise<(ProductDetail & { hasStock?: boolean; hasPrice?: boolean; stockQty?: number | null }) | null> {
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("products_tango")
    .select(SELECT_COLS)
    .eq("active", true)
    .eq("cod_articulo", codArticulo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const base = toListItem(data as TangoProductRow);
  const name = base.name;

  return {
    ...base,
    description: data.descripcion?.trim() || name,
    markets: [],
    attributes: [
      ...(data.unidad
        ? [{ name: "Unidad", slug: "unidad", value_text: data.unidad }]
        : []),
      ...(data.cod_barra
        ? [{ name: "Código de barras", slug: "barcode", value_text: data.cod_barra }]
        : []),
      ...(data.has_stock
        ? [
            {
              name: "Stock",
              slug: "stock",
              value_text:
                data.stock_qty != null ? String(data.stock_qty) : "Disponible",
            },
          ]
        : []),
    ],
    gallery: base.image ? [{ ...base.image, role: "featured" }] : [],
    documents: [],
  };
}

/**
 * Lista plana del catálogo Tango (sin colapsar variantes) para Stock PWA.
 * Server-side over all matching rows (sin tope artificial de página).
 */
export async function listTangoStockRows(
  filters: TangoProductFilters = {},
): Promise<TangoProductRow[]> {
  return fetchAllMatchingRows(filters);
}

export async function getTangoProductsByCodes(
  codes: string[],
): Promise<ProductListItem[]> {
  const unique = [...new Set(codes.filter(Boolean))];
  if (!unique.length) return [];
  const supabase = await createCommercialServerClient();
  const items: ProductListItem[] = [];
  for (let i = 0; i < unique.length; i += REST_PAGE) {
    const chunk = unique.slice(i, i + REST_PAGE);
    const { data, error } = await supabase
      .from("products_tango")
      .select(SELECT_COLS)
      .eq("active", true)
      .in("cod_articulo", chunk);
    if (error) throw new Error(error.message);
    items.push(...(data ?? []).map((row) => toListItem(row as TangoProductRow)));
  }
  return items;
}
