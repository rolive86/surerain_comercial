import { createServerSupabaseClient } from "@/lib/supabase/server";
import { publicStorageUrl } from "@/lib/storage";

export type CatalogFilters = {
  q?: string;
  category?: string;
  brand?: string;
  market?: string;
  type?: string;
};

export type MediaInfo = {
  id: string;
  alt_text: string | null;
  bucket: string | null;
  storage_path: string | null;
  url: string | null;
};

export type ProductListItem = {
  id: string;
  source_id: string;
  name: string;
  slug: string;
  short_description: string | null;
  brand_name: string | null;
  brand_slug: string | null;
  category_name: string | null;
  category_slug: string | null;
  type_name: string | null;
  type_slug: string | null;
  image: MediaInfo | null;
  finalPrice?: { amount: number; currency: string } | null;
  tangoCode?: string | null;
};

export type ProductDetail = ProductListItem & {
  description: string;
  markets: Array<{ name: string; slug: string }>;
  attributes: Array<{ name: string; slug: string; value_text: string | null }>;
  gallery: Array<MediaInfo & { role: string }>;
  documents: Array<{
    id: string;
    name: string;
    document_type: string;
    url: string | null;
  }>;
};

function mapMedia(
  media:
    | {
        id: string;
        alt_text: string | null;
        bucket: string | null;
        storage_path: string | null;
      }
    | null
    | undefined,
): MediaInfo | null {
  if (!media) return null;
  return {
    id: media.id,
    alt_text: media.alt_text,
    bucket: media.bucket,
    storage_path: media.storage_path,
    url: publicStorageUrl(media.bucket, media.storage_path),
  };
}

export async function getCategories() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, sort_order")
    .eq("active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBrands() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, slug")
    .eq("active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getMarkets() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("markets")
    .select("id, name, slug")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getProductTypes() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("product_types")
    .select("id, name, slug")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCatalogProducts(
  filters: CatalogFilters = {},
): Promise<ProductListItem[]> {
  const supabase = createServerSupabaseClient();

  let query = supabase
    .from("products")
    .select(
      `
      id,
      source_id,
      name,
      slug,
      short_description,
      brands ( name, slug ),
      product_types ( name, slug ),
      featured_image:media!products_featured_image_id_fkey (
        id, alt_text, bucket, storage_path
      ),
      product_categories (
        is_primary,
        categories ( name, slug )
      ),
      product_markets (
        markets ( name, slug )
      )
    `,
    )
    .eq("published", true)
    .eq("source_active", true)
    .order("sort_order");

  if (filters.brand) {
    const { data: brand } = await supabase
      .from("brands")
      .select("id")
      .eq("slug", filters.brand)
      .maybeSingle();
    if (brand?.id) query = query.eq("brand_id", brand.id);
    else return [];
  }

  if (filters.type) {
    const { data: type } = await supabase
      .from("product_types")
      .select("id")
      .eq("slug", filters.type)
      .maybeSingle();
    if (type?.id) query = query.eq("product_type_id", type.id);
    else return [];
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const q = (filters.q || "").trim().toLowerCase();
  const category = filters.category || "";
  const market = filters.market || "";

  const items = (data ?? [])
    .map((row) => {
      const brand = Array.isArray(row.brands) ? row.brands[0] : row.brands;
      const type = Array.isArray(row.product_types)
        ? row.product_types[0]
        : row.product_types;
      const featured = Array.isArray(row.featured_image)
        ? row.featured_image[0]
        : row.featured_image;
      const pcs = row.product_categories ?? [];
      const primary =
        pcs.find((pc) => pc.is_primary)?.categories ??
        pcs[0]?.categories ??
        null;
      const categoryObj = Array.isArray(primary) ? primary[0] : primary;
      const markets = (row.product_markets ?? [])
        .map((pm) => {
          const m = Array.isArray(pm.markets) ? pm.markets[0] : pm.markets;
          return m;
        })
        .filter(Boolean) as Array<{ name: string; slug: string }>;

      return {
        id: row.id,
        source_id: row.source_id,
        name: row.name,
        slug: row.slug,
        short_description: row.short_description,
        brand_name: brand?.name ?? null,
        brand_slug: brand?.slug ?? null,
        category_name: categoryObj?.name ?? null,
        category_slug: categoryObj?.slug ?? null,
        type_name: type?.name ?? null,
        type_slug: type?.slug ?? null,
        image: mapMedia(featured),
        _markets: markets,
      };
    })
    .filter((item) => {
      if (category && item.category_slug !== category) return false;
      if (market && !item._markets.some((m) => m.slug === market)) return false;
      if (q) {
        const hay = [
          item.name,
          item.brand_name,
          item.category_name,
          item.type_name,
          item.short_description,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map(({ _markets: _, ...item }) => item);

  return items;
}

export async function getFeaturedProducts(limit = 8): Promise<ProductListItem[]> {
  const all = await getCatalogProducts();
  return all.slice(0, limit);
}

/** Resuelve cards del catálogo por `source_id` (recomendaciones / rieles). */
export async function getCatalogProductsBySourceIds(
  sourceIds: string[],
): Promise<ProductListItem[]> {
  const unique = [...new Set(sourceIds.filter(Boolean))];
  if (!unique.length) return [];

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id,
      source_id,
      name,
      slug,
      short_description,
      brands ( name, slug ),
      product_types ( name, slug ),
      featured_image:media!products_featured_image_id_fkey (
        id, alt_text, bucket, storage_path
      ),
      product_categories (
        is_primary,
        categories ( name, slug )
      )
    `,
    )
    .in("source_id", unique)
    .eq("published", true)
    .eq("source_active", true);
  if (error) throw new Error(error.message);

  const mapped = (data ?? []).map((row) => {
    const brand = Array.isArray(row.brands) ? row.brands[0] : row.brands;
    const type = Array.isArray(row.product_types)
      ? row.product_types[0]
      : row.product_types;
    const featured = Array.isArray(row.featured_image)
      ? row.featured_image[0]
      : row.featured_image;
    const pcs = row.product_categories ?? [];
    const primary =
      pcs.find((pc) => pc.is_primary)?.categories ?? pcs[0]?.categories ?? null;
    const categoryObj = Array.isArray(primary) ? primary[0] : primary;
    return {
      id: row.id,
      source_id: row.source_id,
      name: row.name,
      slug: row.slug,
      short_description: row.short_description,
      brand_name: brand?.name ?? null,
      brand_slug: brand?.slug ?? null,
      category_name: categoryObj?.name ?? null,
      category_slug: categoryObj?.slug ?? null,
      type_name: type?.name ?? null,
      type_slug: type?.slug ?? null,
      image: mapMedia(featured),
    } satisfies ProductListItem;
  });

  const byId = new Map(mapped.map((p) => [p.source_id, p]));
  return unique.map((id) => byId.get(id)).filter((p): p is ProductListItem => Boolean(p));
}

/** Thumbnails del catálogo por `source_id` (p.ej. ítems de carrito/pedido). */
export async function getProductThumbnailsBySourceIds(
  sourceIds: string[],
): Promise<Map<string, { url: string; alt: string | null }>> {
  const unique = [...new Set(sourceIds.filter(Boolean))];
  const map = new Map<string, { url: string; alt: string | null }>();
  if (!unique.length) return map;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      source_id,
      name,
      featured_image:media!products_featured_image_id_fkey (
        alt_text, bucket, storage_path
      )
    `,
    )
    .in("source_id", unique);
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const featured = Array.isArray(row.featured_image)
      ? row.featured_image[0]
      : row.featured_image;
    const url = publicStorageUrl(featured?.bucket, featured?.storage_path);
    if (!url) continue;
    map.set(row.source_id, {
      url,
      alt: featured?.alt_text ?? row.name ?? null,
    });
  }
  return map;
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id,
      source_id,
      name,
      slug,
      description,
      short_description,
      brands ( name, slug ),
      product_types ( name, slug ),
      featured_image:media!products_featured_image_id_fkey (
        id, alt_text, bucket, storage_path
      ),
      product_categories (
        is_primary,
        categories ( name, slug )
      ),
      product_markets (
        markets ( name, slug )
      ),
      product_media (
        role,
        sort_order,
        media ( id, alt_text, bucket, storage_path )
      ),
      documents (
        id, name, document_type, bucket, storage_path
      ),
      product_attribute_values (
        value_text,
        attributes ( name, slug )
      )
    `,
    )
    .eq("slug", slug)
    .eq("published", true)
    .eq("source_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const brand = Array.isArray(data.brands) ? data.brands[0] : data.brands;
  const type = Array.isArray(data.product_types)
    ? data.product_types[0]
    : data.product_types;
  const featured = Array.isArray(data.featured_image)
    ? data.featured_image[0]
    : data.featured_image;
  const pcs = data.product_categories ?? [];
  const primary =
    pcs.find((pc) => pc.is_primary)?.categories ?? pcs[0]?.categories ?? null;
  const categoryObj = Array.isArray(primary) ? primary[0] : primary;

  const markets = (data.product_markets ?? [])
    .map((pm) => {
      const m = Array.isArray(pm.markets) ? pm.markets[0] : pm.markets;
      return m;
    })
    .filter(Boolean) as Array<{ name: string; slug: string }>;

  const gallery = (data.product_media ?? [])
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((pm) => {
      const media = Array.isArray(pm.media) ? pm.media[0] : pm.media;
      const mapped = mapMedia(media);
      if (!mapped) return null;
      return { ...mapped, role: pm.role };
    })
    .filter(Boolean) as Array<MediaInfo & { role: string }>;

  const documents = (data.documents ?? [])
    .map((d) => ({
      id: d.id,
      name: d.name,
      document_type: d.document_type,
      url: publicStorageUrl(d.bucket, d.storage_path),
    }))
    .filter((d) => Boolean(d.url));

  const hiddenAttrSlugs = new Set(["descripcion-original"]);
  const attributes = (data.product_attribute_values ?? [])
    .map((v) => {
      const attr = Array.isArray(v.attributes) ? v.attributes[0] : v.attributes;
      if (!attr || hiddenAttrSlugs.has(attr.slug)) return null;
      if (!v.value_text?.trim()) return null;
      return {
        name: attr.name,
        slug: attr.slug,
        value_text: v.value_text,
      };
    })
    .filter(Boolean) as Array<{
    name: string;
    slug: string;
    value_text: string | null;
  }>;

  return {
    id: data.id,
    source_id: data.source_id,
    name: data.name,
    slug: data.slug,
    description: data.description,
    short_description: data.short_description,
    brand_name: brand?.name ?? null,
    brand_slug: brand?.slug ?? null,
    category_name: categoryObj?.name ?? null,
    category_slug: categoryObj?.slug ?? null,
    type_name: type?.name ?? null,
    type_slug: type?.slug ?? null,
    image: mapMedia(featured),
    markets,
    attributes,
    gallery,
    documents,
  };
}

export async function getCatalogStats() {
  const supabase = createServerSupabaseClient();
  const [products, categories, brands] = await Promise.all([
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("published", true)
      .eq("source_active", true),
    supabase
      .from("categories")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
    supabase
      .from("brands")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
  ]);
  return {
    products: products.count ?? 0,
    categories: categories.count ?? 0,
    brands: brands.count ?? 0,
  };
}
