/**
 * Customer can read effective_prices, cannot read prices (base).
 */
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { ROOT } from "../../src/config.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_COMMERCIAL_SUPABASE_URL");
  const anon = requireEnv("NEXT_PUBLIC_COMMERCIAL_SUPABASE_ANON_KEY");
  const email = process.env.DEMO_CUSTOMER_EMAIL ?? "cliente.demo@surerain.test";
  const password = requireEnv("DEMO_PASSWORD");

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
  if (loginErr) throw new Error(loginErr.message);

  const { data: prices, error: pricesErr } = await supabase.from("prices").select("id").limit(5);
  const { data: eff, error: effErr } = await supabase
    .from("effective_prices")
    .select("cod_articulo, final_amount, customer_id")
    .limit(5);

  const pricesBlocked = (prices?.length ?? 0) === 0;
  const effOk = !effErr && (eff?.length ?? 0) > 0;

  console.log(
    JSON.stringify(
      {
        pricesRows: prices?.length ?? 0,
        pricesError: pricesErr?.message ?? null,
        pricesBlocked,
        effectiveRows: eff?.length ?? 0,
        effectiveError: effErr?.message ?? null,
        effOk,
        pass: pricesBlocked && effOk,
      },
      null,
      2,
    ),
  );
  if (!pricesBlocked || !effOk) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
