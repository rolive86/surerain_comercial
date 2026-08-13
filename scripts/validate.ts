import path from "node:path";
import { PATHS } from "../src/config.js";
import {
  ensureDir,
  log,
  nowIso,
  pathExists,
  readJson,
  writeJson,
} from "../src/lib/io.js";
import type {
  DiscoveryReport,
  NormalizedDataset,
  RawCatalogSnapshot,
} from "../src/types.js";
import { ROOT } from "../src/config.js";

async function main() {
  log("validate", "Running integrity audit");
  await ensureDir(PATHS.reports);

  const raw = await readJson<RawCatalogSnapshot>(
    path.join(PATHS.dataRaw, "catalog.raw.json"),
  );
  const dataset = await readJson<NormalizedDataset>(
    path.join(PATHS.dataNormalized, "dataset.json"),
  );
  const discovery = await readJson<DiscoveryReport>(
    path.join(PATHS.reports, "discovery-report.json"),
  );
  const crawl = await readJson<Record<string, unknown>>(
    path.join(PATHS.reports, "crawl-report.json"),
  );
  const download = await readJson<Record<string, unknown>>(
    path.join(PATHS.reports, "download-media-report.json"),
  );

  const errors: Array<{ code: string; message: string; ref?: string }> = [];

  if (!raw) errors.push({ code: "missing_raw", message: "catalog.raw.json missing" });
  if (!dataset)
    errors.push({ code: "missing_normalized", message: "dataset.json missing" });

  const published = raw?.published_total ?? discovery?.catalog.published_total ?? null;
  const detected = raw?.product_count ?? 0;
  const extracted = raw?.products.length ?? 0;
  const normalizedActive =
    dataset?.products.filter((p) => p.source_active).length ?? 0;
  const normalizedTotal = dataset?.products.length ?? 0;

  // Uniqueness checks
  const sourceIds = new Set<string>();
  const dupSource: string[] = [];
  for (const p of raw?.products ?? []) {
    if (sourceIds.has(p.source_id)) dupSource.push(p.source_id);
    sourceIds.add(p.source_id);
  }

  const slugCounts = new Map<string, number>();
  for (const p of dataset?.products.filter((x) => x.source_active) ?? []) {
    slugCounts.set(p.slug, (slugCounts.get(p.slug) ?? 0) + 1);
  }
  const dupSlugs = [...slugCounts.entries()].filter(([, n]) => n > 1);

  // Provenance: each active product should have raw_ref
  let missingRawRef = 0;
  let missingLocalMedia = 0;
  let mediaOk = 0;
  for (const p of dataset?.products.filter((x) => x.source_active) ?? []) {
    if (!p.raw_ref) missingRawRef++;
    else if (!(await pathExists(path.join(ROOT, p.raw_ref)))) missingRawRef++;
  }
  for (const m of dataset?.media ?? []) {
    if (!m.local_path) {
      missingLocalMedia++;
      continue;
    }
    const exists = await pathExists(path.join(ROOT, m.local_path));
    if (exists) mediaOk++;
    else missingLocalMedia++;
  }

  if (published !== null && extracted !== published) {
    errors.push({
      code: "count_mismatch",
      message: `Published ${published} vs extracted ${extracted}`,
    });
  }
  if (dupSource.length) {
    errors.push({
      code: "duplicate_source_id",
      message: `${dupSource.length} duplicate source_ids`,
    });
  }
  if (dupSlugs.length) {
    errors.push({
      code: "duplicate_slug",
      message: `${dupSlugs.length} duplicate slugs among active products`,
    });
  }
  if (missingRawRef) {
    errors.push({
      code: "missing_raw_ref",
      message: `${missingRawRef} products missing raw provenance file`,
    });
  }

  // Products without image / description
  const noImage =
    dataset?.products.filter((p) => p.source_active && !p.featured_image_id)
      .length ?? 0;
  const noDesc =
    dataset?.products.filter(
      (p) => p.source_active && !p.description?.trim(),
    ).length ?? 0;

  const nameDupes =
    discovery?.catalog.duplicate_names ??
    (() => {
      const c = new Map<string, number>();
      for (const p of raw?.products ?? []) c.set(p.name, (c.get(p.name) ?? 0) + 1);
      return [...c.entries()]
        .filter(([, n]) => n > 1)
        .map(([name, count]) => ({ name, count }));
    })();

  const report = {
    generated_at: nowIso(),
    totals: {
      TOTAL_PUBLICADO: published,
      TOTAL_DETECTADO: detected,
      TOTAL_EXTRAIDO: extracted,
      TOTAL_NORMALIZADO_ACTIVOS: normalizedActive,
      TOTAL_NORMALIZADO_INCLUYE_INACTIVOS: normalizedTotal,
    },
    catalog: {
      categories: dataset?.categories.length ?? 0,
      brands: dataset?.brands.length ?? 0,
      markets: dataset?.markets.length ?? 0,
      product_types: dataset?.product_types.length ?? 0,
      attributes: dataset?.attributes.length ?? 0,
      documents: dataset?.documents.length ?? 0,
      media: dataset?.media.length ?? 0,
      duplicate_names: nameDupes,
      products_without_image: noImage,
      products_without_description: noDesc,
      products_with_ficha:
        dataset?.documents.filter((d) => d.document_type === "ficha_tecnica")
          .length ?? 0,
    },
    media_audit: {
      downloaded_ok: mediaOk,
      missing_local: missingLocalMedia,
      download_report: download ?? null,
    },
    crawl_audit: crawl ?? null,
    sync_meta: dataset?.sync_meta ?? null,
    integrity: {
      duplicate_source_ids: dupSource,
      duplicate_slugs: dupSlugs.map(([slug, count]) => ({ slug, count })),
      missing_raw_refs: missingRawRef,
      provenance_model:
        "normalized.product.raw_ref → data/raw/products/*.json → original_url + outer_html/onclick",
    },
    errors,
    ok: errors.length === 0,
  };

  await writeJson(path.join(PATHS.reports, "validation-report.json"), report);
  await writeJson(path.join(PATHS.reports, "errors.json"), {
    generated_at: nowIso(),
    errors,
  });

  log("validate", report.ok ? "Validation OK" : "Validation with issues", {
    totals: report.totals,
    error_count: errors.length,
  });

  if (!report.ok) process.exitCode = 0; // informational; do not hard-fail pipeline
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
