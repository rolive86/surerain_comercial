/**
 * Normalize tango.listas_precios_raw / precios_raw → public.price_lists / prices
 * then recompute effective_prices. Service role only.
 */
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { ROOT } from "../../src/config.js";
import type { Database, Json } from "../../src/types/commercial.types.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

const LIST_CODE = "29";
const VALID_FROM = "2025-04-01T00:00:00.000Z";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function asText(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function asBool(value: unknown): boolean | null {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return null;
}

function asNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_COMMERCIAL_SUPABASE_URL");
  const service = requireEnv("COMMERCIAL_SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient<Database>(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: listasJson, error: listasErr } = await supabase.rpc("tango_staging_fetch", {
    p_entity: "listas_precios",
  });
  if (listasErr) throw new Error(listasErr.message);
  const listas = (listasJson as Json[] | null) ?? [];
  if (!Array.isArray(listas)) throw new Error("listas_precios fetch is not an array");

  let listsUpserted = 0;
  for (const raw of listas) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const code = asText(r.nro_de_lis);
    const name = asText(r.nombre);
    if (!code || !name) continue;
    const monCte = asBool(r.mon_cte);
    const currency = monCte === false ? "USD" : "ARS";
    const { error } = await supabase.from("price_lists").upsert(
      {
        code,
        name,
        currency,
        active: asBool(r.habilitada) ?? true,
        tango_price_list_id: asText(r.id_gva10),
        source_system: "tango",
        last_synced_at: new Date().toISOString(),
        sync_status: "ok",
      },
      { onConflict: "code" },
    );
    if (error) throw new Error(`price_lists ${code}: ${error.message}`);
    listsUpserted += 1;
  }

  const { data: list29, error: list29Err } = await supabase
    .from("price_lists")
    .select("id, code, name, currency")
    .eq("code", LIST_CODE)
    .maybeSingle();
  if (list29Err) throw new Error(list29Err.message);
  if (!list29) throw new Error("price_lists code=29 missing after upsert");

  const { data: preciosJson, error: preciosErr } = await supabase.rpc("tango_staging_fetch", {
    p_entity: "precios",
  });
  if (preciosErr) throw new Error(preciosErr.message);
  const precios = (preciosJson as Json[] | null) ?? [];
  if (!Array.isArray(precios)) throw new Error("precios fetch is not an array");

  const rows29 = precios
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      if (asText(r.cod_lista) !== LIST_CODE) return null;
      const cod = asText(r.cod_articulo);
      const amount = asNum(r.precio);
      if (!cod || amount == null) return null;
      return {
        price_list_id: list29.id,
          product_source_id: cod,
          amount,
          tango_id: `${LIST_CODE}:${cod}`,
          valid_from: VALID_FROM,
          last_synced_at: new Date().toISOString(),
          sync_status: "ok",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  if (!rows29.length) throw new Error("no precios for lista 29 after map");

  for (const row of rows29) {
    const { error: insErr } = await supabase.from("prices").upsert(row, {
      onConflict: "price_list_id,product_source_id,valid_from",
    });
    if (insErr) throw new Error(`prices upsert ${row.product_source_id}: ${insErr.message}`);
  }

  const { error: recErr } = await supabase.rpc("recompute_effective_prices");
  if (recErr) throw new Error(recErr.message);

  const { count: pricesCount } = await supabase
    .from("prices")
    .select("*", { count: "exact", head: true })
    .eq("price_list_id", list29.id);
  const { count: effCount } = await supabase
    .from("effective_prices")
    .select("*", { count: "exact", head: true })
    .is("customer_id", null);

  console.log(
    JSON.stringify(
      {
        listsUpserted,
        list29,
        pricesLista29: pricesCount,
        effectiveDefault: effCount,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
