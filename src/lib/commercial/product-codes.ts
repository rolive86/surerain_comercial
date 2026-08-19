import { createCommercialServerClient } from "@/lib/supabase/commercial/server";

/** Código Tango (Excel / product_map) por source_id de catálogo. */
export async function getProductCodesBySourceIds(
  sourceIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(sourceIds.filter(Boolean))];
  if (!ids.length) return out;

  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase.rpc("catalog_product_codes", {
    p_source_ids: ids,
  });
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    if (row.source_id && row.cod_articulo) out.set(row.source_id, row.cod_articulo);
  }
  return out;
}

export async function withProductCodes<T extends { source_id: string }>(
  items: T[],
): Promise<Array<T & { tangoCode: string | null }>> {
  const codes = await getProductCodesBySourceIds(items.map((i) => i.source_id));
  return items.map((item) => ({
    ...item,
    tangoCode: codes.get(item.source_id) ?? null,
  }));
}
