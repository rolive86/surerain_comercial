import { createCommercialAdminClient } from "@/lib/supabase/commercial/admin";
import { createCommercialServerClient } from "@/lib/supabase/commercial/server";

export type ProductGroup = {
  id: string;
  slug: string | null;
  name: string;
  familia: string | null;
  needs_review: boolean;
  source: string;
};

export type ProductVariant = {
  cod_articulo: string;
  group_id: string | null;
  variant_label: string | null;
  sort_order: number;
  descripcion?: string | null;
  image_url?: string | null;
  has_stock?: boolean;
  has_price?: boolean;
  stock_qty?: number | null;
  familia?: string | null;
};

export type ProductGroupDetail = ProductGroup & {
  variants: ProductVariant[];
};

function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return base || "grupo";
}

async function uniqueSlug(
  supabase: ReturnType<typeof createCommercialAdminClient>,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let i = 2;
  for (;;) {
    let q = supabase.from("product_groups").select("id").eq("slug", candidate);
    if (excludeId) q = q.neq("id", excludeId);
    const { data, error } = await q.maybeSingle();
    if (error && error.code !== "PGRST116") throw new Error(error.message);
    if (!data) return candidate;
    candidate = `${base}-${i++}`;
  }
}

export async function getProductGroupCoverage(): Promise<{
  total: number;
  reviewed: number;
  needsReview: number;
}> {
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("product_groups")
    .select("needs_review");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const needsReview = rows.filter((r) => r.needs_review).length;
  return {
    total: rows.length,
    needsReview,
    reviewed: rows.length - needsReview,
  };
}

export async function listProductGroups(opts?: {
  q?: string;
  needsReviewOnly?: boolean;
}): Promise<Array<ProductGroup & { variant_count: number }>> {
  const supabase = await createCommercialServerClient();
  let query = supabase
    .from("product_groups")
    .select("id, slug, name, familia, needs_review, source")
    .order("needs_review", { ascending: false })
    .order("name");

  if (opts?.needsReviewOnly) {
    query = query.eq("needs_review", true);
  }

  const { data: groups, error } = await query;
  if (error) throw new Error(error.message);

  const { data: variants, error: vErr } = await supabase
    .from("product_variants")
    .select("group_id");
  if (vErr) throw new Error(vErr.message);

  const counts = new Map<string, number>();
  for (const v of variants ?? []) {
    if (!v.group_id) continue;
    counts.set(v.group_id, (counts.get(v.group_id) ?? 0) + 1);
  }

  let rows = (groups ?? []).map((g) => ({
    ...g,
    variant_count: counts.get(g.id) ?? 0,
  }));

  const q = opts?.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.familia ?? "").toLowerCase().includes(q) ||
        (g.slug ?? "").toLowerCase().includes(q),
    );
  }

  return rows;
}

export async function getProductGroupBySlug(
  slug: string,
): Promise<ProductGroupDetail | null> {
  const supabase = await createCommercialServerClient();
  const { data: group, error } = await supabase
    .from("product_groups")
    .select("id, slug, name, familia, needs_review, source")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!group) return null;

  const { data: variants, error: vErr } = await supabase
    .from("product_variants")
    .select("cod_articulo, group_id, variant_label, sort_order")
    .eq("group_id", group.id)
    .order("sort_order");
  if (vErr) throw new Error(vErr.message);

  const codes = (variants ?? []).map((v) => v.cod_articulo);
  const ptByCode = new Map<
    string,
    {
      descripcion: string | null;
      image_url: string | null;
      has_stock: boolean;
      has_price: boolean;
      stock_qty: number | null;
      familia: string | null;
    }
  >();

  if (codes.length) {
    const { data: pts, error: pErr } = await supabase
      .from("products_tango")
      .select(
        "cod_articulo, descripcion, image_url, has_stock, has_price, stock_qty, familia",
      )
      .eq("active", true)
      .in("cod_articulo", codes);
    if (pErr) throw new Error(pErr.message);
    for (const p of pts ?? []) {
      ptByCode.set(p.cod_articulo, p);
    }
  }

  return {
    ...group,
    variants: (variants ?? [])
      .map((v): ProductVariant | null => {
        const pt = ptByCode.get(v.cod_articulo);
        if (!pt) return null;
        return {
          ...v,
          descripcion: pt.descripcion,
          image_url: pt.image_url,
          has_stock: pt.has_stock,
          has_price: pt.has_price,
          stock_qty: pt.stock_qty,
          familia: pt.familia,
        };
      })
      .filter((v): v is ProductVariant => v != null),
  };
}

export async function getProductGroupById(
  id: string,
): Promise<ProductGroupDetail | null> {
  const supabase = await createCommercialServerClient();
  const { data: group, error } = await supabase
    .from("product_groups")
    .select("id, slug, name, familia, needs_review, source")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!group) return null;

  const { data: variants, error: vErr } = await supabase
    .from("product_variants")
    .select("cod_articulo, group_id, variant_label, sort_order")
    .eq("group_id", group.id)
    .order("sort_order");
  if (vErr) throw new Error(vErr.message);

  const codes = (variants ?? []).map((v) => v.cod_articulo);
  if (!codes.length) return { ...group, variants: [] };

  const { data: pts, error: pErr } = await supabase
    .from("products_tango")
    .select(
      "cod_articulo, descripcion, image_url, has_stock, has_price, stock_qty, familia",
    )
    .in("cod_articulo", codes);
  if (pErr) throw new Error(pErr.message);
  const ptByCode = new Map((pts ?? []).map((p) => [p.cod_articulo, p]));

  return {
    ...group,
    variants: (variants ?? []).map((v) => {
      const pt = ptByCode.get(v.cod_articulo);
      return {
        ...v,
        descripcion: pt?.descripcion ?? null,
        image_url: pt?.image_url ?? null,
        has_stock: pt?.has_stock,
        has_price: pt?.has_price,
        stock_qty: pt?.stock_qty ?? null,
        familia: pt?.familia ?? null,
      };
    }),
  };
}

export async function getVariantGroupByCode(
  codArticulo: string,
): Promise<{ group: ProductGroup; variants: ProductVariant[] } | null> {
  const supabase = await createCommercialServerClient();
  const { data: link, error } = await supabase
    .from("product_variants")
    .select("group_id")
    .eq("cod_articulo", codArticulo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!link?.group_id) return null;

  const detail = await getProductGroupById(link.group_id);
  if (!detail || detail.variants.length < 2) return null;
  return { group: detail, variants: detail.variants };
}

/** Maps for catalog collapse: code → group meta */
export async function loadVariantIndex(): Promise<{
  groupById: Map<string, ProductGroup & { variant_count: number }>;
  codeToGroupId: Map<string, string>;
}> {
  const supabase = await createCommercialServerClient();
  const [{ data: groups, error: gErr }, { data: variants, error: vErr }] =
    await Promise.all([
      supabase
        .from("product_groups")
        .select("id, slug, name, familia, needs_review, source"),
      supabase.from("product_variants").select("cod_articulo, group_id"),
    ]);
  if (gErr) throw new Error(gErr.message);
  if (vErr) throw new Error(vErr.message);

  const counts = new Map<string, number>();
  const codeToGroupId = new Map<string, string>();
  for (const v of variants ?? []) {
    if (!v.group_id) continue;
    counts.set(v.group_id, (counts.get(v.group_id) ?? 0) + 1);
    codeToGroupId.set(v.cod_articulo, v.group_id);
  }

  const groupById = new Map(
    (groups ?? []).map((g) => [
      g.id,
      { ...g, variant_count: counts.get(g.id) ?? 0 },
    ]),
  );

  return { groupById, codeToGroupId };
}

export async function updateProductGroupAdmin(input: {
  id: string;
  name: string;
  familia?: string | null;
  variants: Array<{ cod_articulo: string; variant_label: string; sort_order: number }>;
}): Promise<void> {
  const supabase = createCommercialAdminClient();
  const slug = await uniqueSlug(supabase, input.name, input.id);
  const { error } = await supabase
    .from("product_groups")
    .update({
      name: input.name.trim(),
      familia: input.familia?.trim() || null,
      slug,
      source: "manual",
      needs_review: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  for (const v of input.variants) {
    const { error: vErr } = await supabase.from("product_variants").upsert({
      cod_articulo: v.cod_articulo,
      group_id: input.id,
      variant_label: v.variant_label.trim() || v.cod_articulo,
      sort_order: v.sort_order,
    });
    if (vErr) throw new Error(vErr.message);
  }
}

export async function moveVariantAdmin(input: {
  cod_articulo: string;
  to_group_id: string | null;
  variant_label?: string | null;
}): Promise<void> {
  const supabase = createCommercialAdminClient();
  if (!input.to_group_id) {
    const { error } = await supabase
      .from("product_variants")
      .delete()
      .eq("cod_articulo", input.cod_articulo);
    if (error) throw new Error(error.message);
    return;
  }

  const { error: gErr } = await supabase
    .from("product_groups")
    .update({
      source: "manual",
      needs_review: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.to_group_id);
  if (gErr) throw new Error(gErr.message);

  const { error } = await supabase.from("product_variants").upsert({
    cod_articulo: input.cod_articulo,
    group_id: input.to_group_id,
    variant_label: input.variant_label?.trim() || input.cod_articulo,
    sort_order: 999,
  });
  if (error) throw new Error(error.message);
}

export async function createProductGroupAdmin(input: {
  name: string;
  familia?: string | null;
  codes: string[];
}): Promise<string> {
  const supabase = createCommercialAdminClient();
  const name = input.name.trim();
  if (!name) throw new Error("El nombre del grupo es obligatorio.");
  const codes = [...new Set(input.codes.map((c) => c).filter(Boolean))];
  if (codes.length < 2) throw new Error("Un grupo necesita al menos 2 códigos.");

  const slug = await uniqueSlug(supabase, name);
  const { data, error } = await supabase
    .from("product_groups")
    .insert({
      name,
      slug,
      familia: input.familia?.trim() || null,
      source: "manual",
      needs_review: false,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  let sort = 0;
  for (const code of codes) {
    const { error: vErr } = await supabase.from("product_variants").upsert({
      cod_articulo: code,
      group_id: data.id,
      variant_label: code,
      sort_order: sort++,
    });
    if (vErr) throw new Error(vErr.message);
  }
  return data.id;
}

export function groupHref(slug: string): string {
  return `/catalogo/g/${encodeURIComponent(slug)}`;
}
