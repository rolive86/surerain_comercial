import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { getCommercialSession } from "@/lib/commercial/session";
import { isStaffRole } from "@/lib/commercial/roles";

export type StockAvailability = {
  cod_articulo: string;
  stock_real: number;
  comprometido: number;
  libre: number;
};

export async function getStockAvailabilityMany(
  codes: string[],
): Promise<Map<string, StockAvailability>> {
  const out = new Map<string, StockAvailability>();
  const unique = [...new Set(codes.filter(Boolean))];
  if (!unique.length) return out;

  const session = await getCommercialSession();
  if (!session || !isStaffRole(session.claims.app_role)) return out;

  const supabase = await createCommercialServerClient();
  /** PostgREST may cap RPC result rows (~1000); chunk inputs to stay under. */
  const CHUNK = 400;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const { data, error } = await supabase.rpc("stock_availability_many", {
      p_codes: slice,
    });
    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      out.set(row.cod_articulo, {
        cod_articulo: row.cod_articulo,
        stock_real: Number(row.stock_real ?? 0),
        comprometido: Number(row.comprometido ?? 0),
        libre: Number(row.libre ?? 0),
      });
    }
  }
  return out;
}

export function formatStockStaff(s: StockAvailability): string {
  const fmt = (n: number) =>
    n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  return `Real ${fmt(s.stock_real)} · Cotizado ${fmt(s.comprometido)} · Libre ${fmt(s.libre)}`;
}
