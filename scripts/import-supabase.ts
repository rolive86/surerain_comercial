import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { ROOT, PATHS } from "../src/config.js";
import { ensureDir, log, nowIso, pathExists, readJson, writeJson } from "../src/lib/io.js";
import type { NormalizedDataset, MediaRecord } from "../src/types.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

type CliOptions = {
  dryRun: boolean;
  smoke: boolean;
  smokeLimit: number;
  skipMedia: boolean;
  limit?: number;
};

type ImportCheckpoint = {
  uploaded_media_ids: string[];
  imported_product_source_ids: string[];
  errors: Array<{ stage: string; ref?: string; message: string }>;
  updated_at: string;
};

const CHECKPOINT = path.join(PATHS.checkpoints, "import-supabase-state.json");

function parseArgs(argv: string[]): CliOptions {
  const dryRun = argv.includes("--dry-run");
  const smoke = argv.includes("--smoke");
  const skipMedia = argv.includes("--skip-media");
  const limitIdx = argv.indexOf("--limit");
  const limit =
    limitIdx >= 0 && argv[limitIdx + 1]
      ? Number(argv[limitIdx + 1])
      : undefined;
  const smokeLimit = smoke ? limit ?? 8 : limit ?? Infinity;
  return { dryRun, smoke, smokeLimit: Number.isFinite(smokeLimit) ? smokeLimit : 8, skipMedia, limit };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in .env.local`);
  return v;
}

function createServiceClient(): SupabaseClient {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bucketForMedia(m: MediaRecord): string {
  if (m.role_hint === "technical") return "product-documents";
  if (m.role_hint === "logo") return "brand-assets";
  return "product-images";
}

function storagePathFor(m: MediaRecord): string {
  // Stable ID-based path; keep original filename for traceability
  return `media/${m.id}/${m.filename}`;
}

function pickSmokeProducts(dataset: NormalizedDataset, limit: number) {
  const byCat = new Map<string, typeof dataset.products>();
  for (const p of dataset.products.filter((x) => x.source_active)) {
    const cat = p.primary_category_id || "none";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(p);
  }
  const out: typeof dataset.products = [];
  const cats = [...byCat.keys()];
  let i = 0;
  while (out.length < limit) {
    const list = byCat.get(cats[i % cats.length]!)!;
    if (list.length) out.push(list.shift()!);
    i++;
    if (cats.every((c) => (byCat.get(c)?.length ?? 0) === 0)) break;
  }
  return out;
}

function filterDataset(
  dataset: NormalizedDataset,
  productIds: Set<string>,
): NormalizedDataset {
  const products = dataset.products.filter((p) => productIds.has(p.id));
  const mediaIds = new Set(
    [
      ...products.flatMap((p) => p.media_ids.map((m) => m.media_id)),
      ...products.map((p) => p.featured_image_id).filter(Boolean),
    ] as string[],
  );
  const media = dataset.media.filter((m) => mediaIds.has(m.id));
  const documents = dataset.documents.filter((d) => productIds.has(d.product_id));
  const brandIds = new Set(products.map((p) => p.brand_id).filter(Boolean) as string[]);
  const typeIds = new Set(
    products.map((p) => p.product_type_id).filter(Boolean) as string[],
  );
  const categoryIds = new Set(
    dataset.product_categories
      .filter((pc) => productIds.has(pc.product_id))
      .map((pc) => pc.category_id),
  );
  const marketIds = new Set(
    dataset.product_markets
      .filter((pm) => productIds.has(pm.product_id))
      .map((pm) => pm.market_id),
  );
  const attrIds = new Set(
    dataset.product_attribute_values
      .filter((v) => productIds.has(v.product_id))
      .map((v) => v.attribute_id),
  );

  return {
    ...dataset,
    products,
    media,
    documents,
    brands: dataset.brands.filter((b) => brandIds.has(b.id)),
    product_types: dataset.product_types.filter((t) => typeIds.has(t.id)),
    categories: dataset.categories.filter((c) => categoryIds.has(c.id)),
    markets: dataset.markets.filter((m) => marketIds.has(m.id)),
    attributes: dataset.attributes.filter((a) => attrIds.has(a.id)),
    product_categories: dataset.product_categories.filter((pc) =>
      productIds.has(pc.product_id),
    ),
    product_markets: dataset.product_markets.filter((pm) =>
      productIds.has(pm.product_id),
    ),
    product_media: dataset.product_media.filter((pm) =>
      productIds.has(pm.product_id),
    ),
    product_attribute_values: dataset.product_attribute_values.filter((v) =>
      productIds.has(v.product_id),
    ),
    product_variants: dataset.product_variants.filter((v) =>
      productIds.has(v.product_id),
    ),
  };
}

async function upsertBatch(
  client: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  dryRun: boolean,
) {
  if (!rows.length) return { count: 0 };
  if (dryRun) return { count: rows.length };
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await client.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table} upsert: ${error.message}`);
  }
  return { count: rows.length };
}

async function validateSchema(client: SupabaseClient) {
  const required = [
    "products",
    "categories",
    "brands",
    "markets",
    "product_types",
    "media",
    "documents",
    "attributes",
    "product_categories",
    "product_markets",
    "product_media",
    "product_attribute_values",
    "product_variants",
    "prices",
    "inventory",
  ];
  const missing: string[] = [];
  for (const t of required) {
    const { error } = await client.from(t).select("*", { count: "exact", head: true });
    if (error) missing.push(`${t}: ${error.message}`);
  }
  const { data: buckets, error: bErr } = await client.storage.listBuckets();
  if (bErr) missing.push(`storage: ${bErr.message}`);
  const bucketIds = new Set((buckets ?? []).map((b) => b.id));
  for (const b of ["product-images", "product-documents", "category-images", "brand-assets"]) {
    if (!bucketIds.has(b)) missing.push(`bucket missing: ${b}`);
  }
  return missing;
}

async function uploadMedia(
  client: SupabaseClient,
  media: MediaRecord[],
  dryRun: boolean,
  checkpoint: ImportCheckpoint,
) {
  const uploaded = new Set(checkpoint.uploaded_media_ids);
  const byChecksumUploaded = new Map<string, { bucket: string; storage_path: string }>();

  // Prefetch already-uploaded media; verify object exists in Storage before skipping
  if (!dryRun) {
    const { data } = await client
      .from("media")
      .select("id, checksum, bucket, storage_path, download_status")
      .eq("download_status", "uploaded");
    for (const row of data ?? []) {
      if (!row.bucket || !row.storage_path) continue;
      const folder = row.storage_path.split("/").slice(0, -1).join("/");
      const file = row.storage_path.split("/").pop()!;
      const { data: listed } = await client.storage.from(row.bucket).list(folder, {
        search: file,
        limit: 20,
      });
      const exists = (listed ?? []).some((f) => f.name === file);
      if (!exists) continue;
      if (row.checksum) {
        byChecksumUploaded.set(row.checksum, {
          bucket: row.bucket,
          storage_path: row.storage_path,
        });
      }
      uploaded.add(row.id);
    }
  }

  let uploadedCount = 0;
  let skipped = 0;
  let failed = 0;
  const updates: Array<{
    id: string;
    bucket: string;
    storage_path: string;
    checksum: string | null;
    file_size: number | null;
    download_status: string;
  }> = [];

  for (const m of media) {
    if (m.download_status === "failed" || !m.local_path) {
      failed++;
      checkpoint.errors.push({
        stage: "media",
        ref: m.original_url,
        message: "missing local file / source 404",
      });
      continue;
    }
    const abs = path.join(ROOT, m.local_path);
    if (!(await pathExists(abs))) {
      failed++;
      checkpoint.errors.push({
        stage: "media",
        ref: m.local_path,
        message: "local file not found",
      });
      continue;
    }

    const bucket = bucketForMedia(m);
    let storagePath = storagePathFor(m);

    // Dedup by checksum: reuse existing storage object
    if (m.checksum && byChecksumUploaded.has(m.checksum)) {
      const existing = byChecksumUploaded.get(m.checksum)!;
      bucket; // keep role bucket preference if already uploaded there
      storagePath = existing.storage_path;
      const useBucket = existing.bucket;
      updates.push({
        id: m.id,
        bucket: useBucket,
        storage_path: storagePath,
        checksum: m.checksum,
        file_size: m.file_size,
        download_status: "uploaded",
      });
      uploaded.add(m.id);
      skipped++;
      continue;
    }

    if (uploaded.has(m.id)) {
      skipped++;
      continue;
    }

    if (dryRun) {
      uploadedCount++;
      continue;
    }

    const body = fs.readFileSync(abs);
    const { error } = await client.storage.from(bucket).upload(storagePath, body, {
      contentType: m.mime_type ?? undefined,
      upsert: true,
    });
    if (error) {
      failed++;
      checkpoint.errors.push({
        stage: "media-upload",
        ref: m.id,
        message: error.message,
      });
      continue;
    }

    if (m.checksum) {
      byChecksumUploaded.set(m.checksum, { bucket, storage_path: storagePath });
    }
    updates.push({
      id: m.id,
      bucket,
      storage_path: storagePath,
      checksum: m.checksum,
      file_size: m.file_size ?? body.length,
      download_status: "uploaded",
    });
    uploaded.add(m.id);
    uploadedCount++;
    checkpoint.uploaded_media_ids = [...uploaded];

    if (uploadedCount % 25 === 0) {
      checkpoint.updated_at = nowIso();
      await writeJson(CHECKPOINT, checkpoint);
      log("import", "media progress", { uploadedCount, skipped, failed });
    }
  }

  if (!dryRun && updates.length) {
    // media rows must already exist; update paths
    for (let i = 0; i < updates.length; i += 100) {
      const chunk = updates.slice(i, i + 100);
      for (const u of chunk) {
        const { error } = await client
          .from("media")
          .update({
            bucket: u.bucket,
            storage_path: u.storage_path,
            checksum: u.checksum,
            file_size: u.file_size,
            download_status: u.download_status,
            updated_at: nowIso(),
          })
          .eq("id", u.id);
        if (error) {
          checkpoint.errors.push({
            stage: "media-update",
            ref: u.id,
            message: error.message,
          });
        }
      }
    }
  }

  return { uploadedCount, skipped, failed, updates };
}

async function importDataset(
  client: SupabaseClient,
  dataset: NormalizedDataset,
  opts: CliOptions,
  checkpoint: ImportCheckpoint,
) {
  const dry = opts.dryRun;

  // Prepare media rows with intended bucket/path
  // Preserve already-uploaded storage metadata on re-runs
  const existingUploaded = new Map<
    string,
    { bucket: string; storage_path: string; download_status: string }
  >();
  if (!dry) {
    const { data: existing } = await client
      .from("media")
      .select("id, bucket, storage_path, download_status")
      .eq("download_status", "uploaded");
    for (const row of existing ?? []) {
      if (row.storage_path && row.bucket) {
        existingUploaded.set(row.id, {
          bucket: row.bucket,
          storage_path: row.storage_path,
          download_status: row.download_status,
        });
      }
    }
  }

  const mediaRows = dataset.media.map((m) => {
    const prev = existingUploaded.get(m.id);
    return {
      id: m.id,
      type: m.type,
      filename: m.filename,
      mime_type: m.mime_type,
      original_url: m.original_url,
      local_path: m.local_path,
      bucket: prev?.bucket ?? bucketForMedia(m),
      storage_path: prev?.storage_path ?? null,
      width: m.width,
      height: m.height,
      file_size: m.file_size,
      checksum: m.checksum,
      alt_text: m.alt_text,
      download_status:
        m.download_status === "failed"
          ? "failed"
          : prev?.download_status ?? "pending",
      created_at: m.created_at,
    };
  });

  log("import", "upsert brands", { n: dataset.brands.length, dry });
  await upsertBatch(
    client,
    "brands",
    dataset.brands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      description: b.description,
      logo_media_id: null, // set after media if needed
      active: b.active,
      source_id: b.source_id,
    })),
    "id",
    dry,
  );

  log("import", "upsert product_types", { n: dataset.product_types.length, dry });
  await upsertBatch(
    client,
    "product_types",
    dataset.product_types.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      source_id: t.source_id,
    })),
    "id",
    dry,
  );

  log("import", "upsert markets", { n: dataset.markets.length, dry });
  await upsertBatch(
    client,
    "markets",
    dataset.markets.map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      description: m.description,
      source_id: m.source_id,
    })),
    "id",
    dry,
  );

  log("import", "upsert categories", { n: dataset.categories.length, dry });
  await upsertBatch(
    client,
    "categories",
    dataset.categories.map((c) => ({
      id: c.id,
      parent_id: c.parent_id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image_id: null,
      sort_order: c.sort_order,
      active: c.active,
      source_id: c.source_id,
    })),
    "id",
    dry,
  );

  log("import", "upsert attributes", { n: dataset.attributes.length, dry });
  await upsertBatch(
    client,
    "attributes",
    dataset.attributes.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      data_type: a.data_type,
      unit: a.unit,
      filterable: a.filterable,
    })),
    "id",
    dry,
  );

  log("import", "upsert media metadata", { n: mediaRows.length, dry });
  await upsertBatch(client, "media", mediaRows, "id", dry);

  log("import", "upsert products", { n: dataset.products.length, dry });
  await upsertBatch(
    client,
    "products",
    dataset.products.map((p) => ({
      id: p.id,
      source_id: p.source_id,
      sku: p.sku,
      name: p.name,
      slug: p.slug,
      short_description: p.short_description,
      description: p.description,
      status: p.status,
      brand_id: p.brand_id,
      product_type_id: p.product_type_id,
      original_url: p.original_url,
      featured_image_id: p.featured_image_id,
      seo_title: p.seo_title,
      seo_description: p.seo_description,
      source_created_at: p.source_created_at,
      source_updated_at: p.source_updated_at,
      source_active: p.source_active,
      first_seen_at: p.first_seen_at,
      last_seen_at: p.last_seen_at,
      content_hash: p.content_hash,
      purchasable: p.purchasable,
      featured: p.featured,
      published: p.published,
      sort_order: p.sort_order,
      created_at: p.created_at,
      updated_at: p.updated_at,
    })),
    "id",
    dry,
  );

  log("import", "upsert product_categories", {
    n: dataset.product_categories.length,
    dry,
  });
  await upsertBatch(
    client,
    "product_categories",
    dataset.product_categories.map((pc) => ({
      product_id: pc.product_id,
      category_id: pc.category_id,
      is_primary: pc.is_primary,
    })),
    "product_id,category_id",
    dry,
  );

  log("import", "upsert product_markets", {
    n: dataset.product_markets.length,
    dry,
  });
  await upsertBatch(
    client,
    "product_markets",
    dataset.product_markets.map((pm) => ({
      product_id: pm.product_id,
      market_id: pm.market_id,
    })),
    "product_id,market_id",
    dry,
  );

  log("import", "upsert product_media", { n: dataset.product_media.length, dry });
  await upsertBatch(
    client,
    "product_media",
    dataset.product_media.map((pm) => ({
      product_id: pm.product_id,
      media_id: pm.media_id,
      role: pm.role,
      sort_order: pm.sort_order,
    })),
    "product_id,media_id,role",
    dry,
  );

  log("import", "upsert documents", { n: dataset.documents.length, dry });
  await upsertBatch(
    client,
    "documents",
    dataset.documents.map((d) => {
      const media = dataset.media.find((m) => m.id === d.media_id);
      return {
        id: d.id,
        product_id: d.product_id,
        name: d.name,
        document_type: d.document_type,
        original_url: d.original_url,
        local_path: d.local_path,
        bucket: media ? bucketForMedia(media) : "product-documents",
        storage_path: media ? storagePathFor(media) : d.storage_path,
        mime_type: d.mime_type,
        checksum: d.checksum,
        media_id: d.media_id,
      };
    }),
    "id",
    dry,
  );

  // Attribute values: delete+insert for selected products (idempotent)
  if (!dry && dataset.product_attribute_values.length) {
    const productIds = [...new Set(dataset.product_attribute_values.map((v) => v.product_id))];
    for (let i = 0; i < productIds.length; i += 50) {
      const chunk = productIds.slice(i, i + 50);
      const { error: delErr } = await client
        .from("product_attribute_values")
        .delete()
        .in("product_id", chunk);
      if (delErr) throw new Error(`pav delete: ${delErr.message}`);
    }
    const rows = dataset.product_attribute_values.map((v) => ({
      product_id: v.product_id,
      attribute_id: v.attribute_id,
      value_text: v.value_text,
      value_number: v.value_number,
      value_boolean: v.value_boolean,
      value_json: v.value_json,
    }));
    // Deduplicate identical text values for same product+attribute
    const seen = new Set<string>();
    const deduped = rows.filter((r) => {
      const key = `${r.product_id}|${r.attribute_id}|${r.value_text ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const chunkSize = 200;
    for (let i = 0; i < deduped.length; i += chunkSize) {
      const chunk = deduped.slice(i, i + chunkSize);
      const { error } = await client.from("product_attribute_values").insert(chunk);
      if (error) throw new Error(`pav insert: ${error.message}`);
    }
  } else if (dry) {
    log("import", "pav dry-run", { n: dataset.product_attribute_values.length });
  }

  // Variants only — no prices/inventory (no invented data)
  log("import", "upsert product_variants", {
    n: dataset.product_variants.length,
    dry,
  });
  await upsertBatch(
    client,
    "product_variants",
    dataset.product_variants.map((v) => ({
      id: v.id,
      product_id: v.product_id,
      sku: v.sku,
      name: v.name,
      active: v.active,
      sort_order: v.sort_order,
    })),
    "id",
    dry,
  );

  let mediaStats = { uploadedCount: 0, skipped: 0, failed: 0, updates: [] as unknown[] };
  if (!opts.skipMedia) {
    log("import", "upload media", { n: dataset.media.length, dry });
    mediaStats = await uploadMedia(client, dataset.media, dry, checkpoint);

    // Sync document storage paths from media updates
    if (!dry) {
      for (const d of dataset.documents) {
        const media = dataset.media.find((m) => m.id === d.media_id);
        if (!media) continue;
        const { error } = await client
          .from("documents")
          .update({
            bucket: bucketForMedia(media),
            storage_path: storagePathFor(media),
            checksum: media.checksum,
          })
          .eq("id", d.id);
        if (error) {
          checkpoint.errors.push({
            stage: "document-update",
            ref: d.id,
            message: error.message,
          });
        }
      }
    }
  }

  checkpoint.imported_product_source_ids = [
    ...new Set([
      ...checkpoint.imported_product_source_ids,
      ...dataset.products.map((p) => p.source_id),
    ]),
  ];
  checkpoint.updated_at = nowIso();
  await writeJson(CHECKPOINT, checkpoint);

  return mediaStats;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  log("import", "Starting Supabase import", {
    dryRun: opts.dryRun,
    smoke: opts.smoke,
    smokeLimit: opts.smoke ? opts.smokeLimit : null,
  });

  await ensureDir(PATHS.checkpoints);
  await ensureDir(PATHS.reports);

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const ref = requireEnv("SUPABASE_PROJECT_REF");
  requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  log("import", "Connected config", { url, ref, serviceRole: "configured" });

  const client = createServiceClient();
  const schemaIssues = await validateSchema(client);
  if (schemaIssues.length) {
    console.error(schemaIssues);
    throw new Error(`Schema validation failed (${schemaIssues.length} issues)`);
  }
  log("import", "Schema OK");

  const dataset = await readJson<NormalizedDataset>(
    path.join(PATHS.dataNormalized, "dataset.json"),
  );
  if (!dataset) throw new Error("Missing data/normalized/dataset.json");

  // Local integrity checks
  const slugCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  for (const p of dataset.products.filter((x) => x.source_active)) {
    slugCounts.set(p.slug, (slugCounts.get(p.slug) ?? 0) + 1);
    sourceCounts.set(p.source_id, (sourceCounts.get(p.source_id) ?? 0) + 1);
  }
  const dupSlugs = [...slugCounts.entries()].filter(([, n]) => n > 1);
  const dupSources = [...sourceCounts.entries()].filter(([, n]) => n > 1);
  if (dupSlugs.length || dupSources.length) {
    throw new Error(
      `Local integrity failed: dupSlugs=${dupSlugs.length} dupSources=${dupSources.length}`,
    );
  }

  let working = dataset;
  if (opts.smoke || (opts.limit && opts.limit > 0 && opts.limit < Infinity)) {
    const sample = pickSmokeProducts(
      dataset,
      opts.smoke ? opts.smokeLimit : (opts.limit as number),
    );
    working = filterDataset(dataset, new Set(sample.map((p) => p.id)));
    log("import", "Filtered sample", {
      products: working.products.length,
      media: working.media.length,
      categories: working.categories.length,
    });
  }

  // File checks
  let missingFiles = 0;
  for (const m of working.media) {
    if (m.download_status === "failed") continue;
    if (!m.local_path || !(await pathExists(path.join(ROOT, m.local_path)))) {
      missingFiles++;
    }
  }

  if (opts.dryRun) {
    const report = {
      generated_at: nowIso(),
      mode: "dry-run",
      project_ref: ref,
      url,
      products: working.products.length,
      categories: working.categories.length,
      brands: working.brands.length,
      markets: working.markets.length,
      types: working.product_types.length,
      media: working.media.length,
      documents: working.documents.length,
      attribute_values: working.product_attribute_values.length,
      missing_local_files: missingFiles,
      known_source_404: working.media.filter((m) => m.download_status === "failed").length,
      schema_ok: true,
      would_modify: false,
    };
    await writeJson(path.join(PATHS.reports, "import-dry-run-report.json"), report);
    // Still walk import logic without writes
    const checkpoint: ImportCheckpoint = {
      uploaded_media_ids: [],
      imported_product_source_ids: [],
      errors: [],
      updated_at: nowIso(),
    };
    await importDataset(client, working, opts, checkpoint);
    log("import", "DRY RUN PASS", report);
    return;
  }

  const checkpoint = (await readJson<ImportCheckpoint>(CHECKPOINT)) ?? {
    uploaded_media_ids: [],
    imported_product_source_ids: [],
    errors: [],
    updated_at: nowIso(),
  };

  const mediaStats = await importDataset(client, working, opts, checkpoint);

  const report = {
    generated_at: nowIso(),
    mode: opts.smoke ? "smoke" : "full",
    project_ref: ref,
    products_imported: working.products.length,
    media_stats: mediaStats,
    errors: checkpoint.errors.slice(-50),
    error_count: checkpoint.errors.length,
  };
  await writeJson(path.join(PATHS.reports, "import-supabase-report.json"), report);
  log("import", "Import complete", report);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
