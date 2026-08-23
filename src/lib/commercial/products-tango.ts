import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import type { ProductListItem, ProductDetail } from "@/lib/catalog";

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
  const supabase = await createCommercialServerClient();
  const safePage = Math.max(1, page);
  const size = Math.max(1, Math.min(pageSize, 100));
  const from = (safePage - 1) * size;
  const to = from + size - 1;

  let query = supabase
    .from("products_tango")
    .select(SELECT_COLS, { count: "exact" })
    .eq("active", true);

  query = applyFilters(query as unknown as FilterableQuery, filters) as typeof query;
  query = applyCatalogOrder(query as unknown as FilterableQuery) as typeof query;

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);
  return {
    items: (data ?? []).map((row) => toListItem(row as TangoProductRow)),
    total: count ?? 0,
  };
}

export async function getTangoProducts(
  filters: TangoProductFilters = {},
  opts?: { limit?: number },
): Promise<ProductListItem[]> {
  const supabase = await createCommercialServerClient();
  const limit = opts?.limit;
  const items: ProductListItem[] = [];
  let from = 0;

  for (;;) {
    const chunkSize = limit
      ? Math.min(REST_PAGE, limit - items.length)
      : REST_PAGE;
    if (chunkSize <= 0) break;

    let query = supabase
      .from("products_tango")
      .select(SELECT_COLS)
      .eq("active", true);

    query = applyFilters(query as unknown as FilterableQuery, filters) as typeof query;
    query = applyCatalogOrder(query as unknown as FilterableQuery) as typeof query;

    const { data, error } = await query.range(from, from + chunkSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    items.push(...rows.map((row) => toListItem(row as TangoProductRow)));

    if (limit && items.length >= limit) return items.slice(0, limit);
    if (rows.length < chunkSize) break;
    from += chunkSize;
  }
  return items;
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
