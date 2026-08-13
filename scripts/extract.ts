import path from "node:path";
import { CATALOG_URL, PATHS } from "../src/config.js";
import {
  parseCatalogHtml,
  summarizeCatalog,
} from "../src/lib/catalog-parser.js";
import {
  ensureDir,
  fetchWithRetry,
  log,
  nowIso,
  pathExists,
  readJson,
  writeJson,
  writeText,
} from "../src/lib/io.js";
import type { RawCatalogSnapshot, RawProductCard } from "../src/types.js";

type ExtractState = {
  last_run_at: string;
  html_sha256: string | null;
  product_source_ids: string[];
};

const STATE_PATH = path.join(PATHS.checkpoints, "extract-state.json");

async function main() {
  const smokeLimit = process.env.SMOKE_LIMIT
    ? Number(process.env.SMOKE_LIMIT)
    : null;

  log("extract", "Extracting structured products from catalog HTML", {
    smokeLimit,
  });
  await ensureDir(PATHS.dataRaw);
  await ensureDir(PATHS.checkpoints);
  await ensureDir(path.join(PATHS.dataRaw, "products"));

  // Prefer already-crawled HTML if present and fresh enough; otherwise fetch.
  const localHtmlCandidates = [
    path.join(PATHS.originalHtml, "catalogo.html"),
    path.join(PATHS.dataRaw, "catalogo.source.html"),
  ];

  let html: string | null = null;
  let finalUrl = CATALOG_URL;
  let sourceUrl = CATALOG_URL;

  for (const candidate of localHtmlCandidates) {
    if (await pathExists(candidate)) {
      const { readFile } = await import("node:fs/promises");
      html = await readFile(candidate, "utf8");
      sourceUrl = `file://${candidate}`;
      log("extract", `Using local HTML ${candidate}`);
      break;
    }
  }

  if (!html) {
    const res = await fetchWithRetry(CATALOG_URL, { accept: "text/html" });
    if (!res.ok) throw new Error(`Catalog fetch failed: HTTP ${res.status}`);
    html = res.body.toString("utf8");
    finalUrl = res.finalUrl;
    await writeText(path.join(PATHS.dataRaw, "catalogo.source.html"), html);
  }

  let snapshot = parseCatalogHtml(html, {
    sourceUrl,
    finalUrl,
    fetchedAt: nowIso(),
  });

  if (smokeLimit && smokeLimit > 0) {
    // Diversify sample across categories
    const byCat = new Map<string, RawProductCard[]>();
    for (const p of snapshot.products) {
      const k = p.category_slug || "unknown";
      if (!byCat.has(k)) byCat.set(k, []);
      byCat.get(k)!.push(p);
    }
    const sample: RawProductCard[] = [];
    const cats = [...byCat.keys()];
    let i = 0;
    while (sample.length < smokeLimit && sample.length < snapshot.products.length) {
      const cat = cats[i % cats.length]!;
      const list = byCat.get(cat)!;
      if (list.length) sample.push(list.shift()!);
      i++;
      if (cats.every((c) => (byCat.get(c)?.length ?? 0) === 0)) break;
    }
    snapshot = { ...snapshot, products: sample, product_count: sample.length };
  }

  // Write per-product raw files for provenance
  for (const product of snapshot.products) {
    const file = path.join(
      PATHS.dataRaw,
      "products",
      `${product.source_id.replace(/[:/\\]/g, "_")}.json`,
    );
    await writeJson(file, product);
  }

  const summary = summarizeCatalog(snapshot);
  const outPath = path.join(PATHS.dataRaw, "catalog.raw.json");
  await writeJson(outPath, snapshot);
  await writeJson(path.join(PATHS.dataRaw, "catalog.summary.json"), {
    generated_at: nowIso(),
    published_total: snapshot.published_total,
    extracted_total: snapshot.product_count,
    ...summary,
  });

  const prev = await readJson<ExtractState>(STATE_PATH);
  const state: ExtractState = {
    last_run_at: nowIso(),
    html_sha256: snapshot.html_sha256,
    product_source_ids: snapshot.products.map((p) => p.source_id),
  };
  await writeJson(STATE_PATH, state);

  // Change detection vs previous extract ids
  const prevIds = new Set(prev?.product_source_ids ?? []);
  const currIds = new Set(state.product_source_ids);
  const added = [...currIds].filter((id) => !prevIds.has(id));
  const removed = [...prevIds].filter((id) => !currIds.has(id));

  await writeJson(path.join(PATHS.reports, "extract-delta.json"), {
    generated_at: nowIso(),
    previous_html_sha256: prev?.html_sha256 ?? null,
    current_html_sha256: snapshot.html_sha256,
    added_source_ids: added,
    removed_source_ids: removed,
    smoke_limit: smokeLimit,
  });

  log("extract", "Extract complete", {
    published_total: snapshot.published_total,
    extracted: snapshot.product_count,
    with_ficha: summary.with_ficha,
    out: outPath,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
