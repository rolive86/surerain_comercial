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

export async function getTangoFamilias(): Promise<Array<{ slug: string; name: string }>> {
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("products_tango")
    .select("familia")
    .eq("active", true)
    .not("familia", "is", null);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const row of data ?? []) {
    const f = row.familia?.trim();
    if (f) set.add(f);
  }
  return [...set]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((name) => ({ slug: name, name }));
}

export async function getTangoProducts(
  filters: TangoProductFilters = {},
): Promise<ProductListItem[]> {
  const supabase = await createCommercialServerClient();
  let query = supabase
    .from("products_tango")
    .select(
      "cod_articulo, descripcion, familia, cod_barra, unidad, catalog_source_id, image_url, has_price, has_stock, stock_qty",
    )
    .eq("active", true)
    .order("descripcion", { ascending: true, nullsFirst: false });

  if (filters.familia) {
    query = query.eq("familia", filters.familia);
  }
  if (filters.disponibilidad === "stock") {
    query = query.eq("has_stock", true);
  } else if (filters.disponibilidad === "confirmar") {
    query = query.eq("has_price", false).eq("has_stock", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  let items = (data ?? []).map((row) => toListItem(row as TangoProductRow));

  const q = filters.q?.trim();
  if (q) {
    const qLower = q.toLowerCase();
    items = items.filter(
      (p) =>
        p.source_id === q ||
        p.tangoCode === q ||
        p.name.toLowerCase().includes(qLower) ||
        (p.category_name?.toLowerCase().includes(qLower) ?? false),
    );
  }
  return items;
}

export async function getTangoProductByCode(
  codArticulo: string,
): Promise<(ProductDetail & { hasStock?: boolean; hasPrice?: boolean; stockQty?: number | null }) | null> {
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("products_tango")
    .select(
      "cod_articulo, descripcion, familia, cod_barra, unidad, catalog_source_id, image_url, has_price, has_stock, stock_qty",
    )
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
  const { data, error } = await supabase
    .from("products_tango")
    .select(
      "cod_articulo, descripcion, familia, cod_barra, unidad, catalog_source_id, image_url, has_price, has_stock, stock_qty",
    )
    .eq("active", true)
    .in("cod_articulo", unique);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toListItem(row as TangoProductRow));
}
