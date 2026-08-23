"use server";

import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { getCommercialSession } from "@/lib/commercial/session";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import { getStockAvailabilityMany } from "@/lib/commercial/stock";

export type TangoProductSearchHit = {
  cod_articulo: string;
  descripcion: string | null;
  stock_real?: number;
  comprometido?: number;
  libre?: number;
};

/** Búsqueda server-side sobre todos los products_tango activos (limit 50). */
export async function searchTangoProductsAction(
  query: string,
): Promise<TangoProductSearchHit[]> {
  const session = await getCommercialSession();
  requireStaffSession(session);

  const needle = query.trim();
  if (!needle) return [];

  const safe = needle.replace(/[%_,]/g, "");
  if (!safe) return [];

  const pattern = `%${safe}%`;
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("products_tango")
    .select("cod_articulo, descripcion")
    .eq("active", true)
    .or(`descripcion.ilike."${pattern}",cod_articulo.ilike."${pattern}"`)
    .order("descripcion")
    .limit(50);

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const stock = await getStockAvailabilityMany(rows.map((r) => r.cod_articulo));
  return rows.map((r) => {
    const s = stock.get(r.cod_articulo);
    return {
      ...r,
      stock_real: s?.stock_real,
      comprometido: s?.comprometido,
      libre: s?.libre,
    };
  });
}
