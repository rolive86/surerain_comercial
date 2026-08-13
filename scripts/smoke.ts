/**
 * Smoke test: extract a diversified sample of ~8 products and print a checklist.
 * Does not require full media download.
 */
import path from "node:path";
import { spawn } from "node:child_process";
import { ROOT, PATHS } from "../src/config.js";
import { log, readJson } from "../src/lib/io.js";
import type { RawCatalogSnapshot } from "../src/types.js";

function run(args: string[], env: Record<string, string> = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("npx", ["tsx", ...args], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: "inherit",
      shell: true,
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`exit ${code}`)),
    );
  });
}

async function main() {
  log("smoke", "Running smoke extract (8 products across categories)");
  await run(["scripts/extract.ts"], { SMOKE_LIMIT: "8" });
  await run(["scripts/normalize.ts"]);

  const raw = await readJson<RawCatalogSnapshot>(
    path.join(PATHS.dataRaw, "catalog.raw.json"),
  );
  if (!raw) throw new Error("smoke extract failed");

  console.log("\n=== SMOKE SAMPLE ===");
  for (const p of raw.products) {
    console.log({
      name: p.name,
      source_id: p.source_id,
      sku_guess: p.name,
      category: p.category_slug,
      brand: p.brand_name,
      markets: p.markets,
      type: p.product_type_slug,
      has_description: Boolean(p.description.trim()),
      specs_rows: p.specs_rows.length,
      image: Boolean(p.image_url),
      ficha: Boolean(p.ficha_url),
      original_url: p.original_url,
    });
  }
  log("smoke", "Smoke OK — review sample above, then run full pipeline without SMOKE_LIMIT");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
