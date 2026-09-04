import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { getCommercialSession } from "@/lib/commercial/session";
import { isValidFinalAmount } from "@/lib/commercial/money";

export type FinalPrice = {
  amount: number;
  currency: string;
};

export { formatFinalUsd } from "@/lib/commercial/money";

function canSeeFinalPrices(role: string | null | undefined): boolean {
  return (
    role === "customer_user" ||
    role === "sales_rep" ||
    role === "sales_manager" ||
    role === "operations" ||
    role === "admin"
  );
}

/** Precio final por source_id de catálogo. Anónimo o sin match → null. */
export async function getFinalPricesBySourceIds(
  sourceIds: string[],
): Promise<Map<string, FinalPrice>> {
  const out = new Map<string, FinalPrice>();
  const ids = [...new Set(sourceIds.filter(Boolean))];
  if (!ids.length) return out;

  const session = await getCommercialSession();
  if (!session || !canSeeFinalPrices(session.claims.app_role)) return out;

  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase.rpc("catalog_final_prices", {
    p_source_ids: ids,
  });
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const amount = Number(row.final_amount);
    if (!isValidFinalAmount(amount)) continue;
    out.set(row.source_id, {
      amount,
      currency: row.currency,
    });
  }
  return out;
}

export async function withFinalPrices<T extends { source_id: string }>(
  items: T[],
): Promise<Array<T & { finalPrice: FinalPrice | null }>> {
  const prices = await getFinalPricesBySourceIds(items.map((i) => i.source_id));
  return items.map((item) => ({
    ...item,
    finalPrice: prices.get(item.source_id) ?? null,
  }));
}

export async function getFinalPriceForSourceId(
  sourceId: string,
): Promise<FinalPrice | null> {
  const map = await getFinalPricesBySourceIds([sourceId]);
  return map.get(sourceId) ?? null;
}
