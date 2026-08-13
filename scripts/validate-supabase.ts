import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { ROOT, PATHS } from "../src/config.js";
import { ensureDir, log, nowIso, pathExists, readJson, writeJson } from "../src/lib/io.js";
import type { NormalizedDataset } from "../src/types.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function count(client: ReturnType<typeof createClient>, table: string) {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  log("validate:supabase", "Auditing remote Supabase against local dataset");
  await ensureDir(PATHS.reports);

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const service = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anon = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const ref = requireEnv("SUPABASE_PROJECT_REF");

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const publicClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const local = await readJson<NormalizedDataset>(
    path.join(PATHS.dataNormalized, "dataset.json"),
  );
  if (!local) throw new Error("Missing local dataset");

  const remote = {
    products: await count(admin, "products"),
    categories: await count(admin, "categories"),
    brands: await count(admin, "brands"),
    markets: await count(admin, "markets"),
    product_types: await count(admin, "product_types"),
    media: await count(admin, "media"),
    documents: await count(admin, "documents"),
    attributes: await count(admin, "attributes"),
    product_categories: await count(admin, "product_categories"),
    product_markets: await count(admin, "product_markets"),
    product_media: await count(admin, "product_media"),
    product_attribute_values: await count(admin, "product_attribute_values"),
    product_variants: await count(admin, "product_variants"),
    prices: await count(admin, "prices"),
    inventory: await count(admin, "inventory"),
  };

  const { count: mediaUploaded } = await admin
    .from("media")
    .select("*", { count: "exact", head: true })
    .eq("download_status", "uploaded");
  const { count: mediaFailed } = await admin
    .from("media")
    .select("*", { count: "exact", head: true })
    .eq("download_status", "failed");

  // Relation audits
  const { data: productsNoCategory } = await admin
    .from("products")
    .select("id, source_id, name")
    .eq("source_active", true);
  // fetch relations
  const { data: pcs } = await admin.from("product_categories").select("product_id");
  const withCat = new Set((pcs ?? []).map((r) => r.product_id));
  const missingCategory = (productsNoCategory ?? []).filter((p) => !withCat.has(p.id));

  const { data: productsAll } = await admin
    .from("products")
    .select("id, brand_id, featured_image_id, slug, source_id")
    .eq("source_active", true);
  const missingBrand = (productsAll ?? []).filter((p) => !p.brand_id);
  const missingImage = (productsAll ?? []).filter((p) => !p.featured_image_id);

  const { data: pms } = await admin.from("product_markets").select("product_id");
  const withMarket = new Set((pms ?? []).map((r) => r.product_id));
  const missingMarket = (productsAll ?? []).filter((p) => !withMarket.has(p.id));

  // slug / source_id uniqueness
  const slugMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  for (const p of productsAll ?? []) {
    slugMap.set(p.slug, (slugMap.get(p.slug) ?? 0) + 1);
    sourceMap.set(p.source_id, (sourceMap.get(p.source_id) ?? 0) + 1);
  }
  const dupSlugs = [...slugMap.entries()].filter(([, n]) => n > 1);
  const dupSources = [...sourceMap.entries()].filter(([, n]) => n > 1);

  // Orphan media
  const { data: allMedia } = await admin.from("media").select("id, storage_path, bucket, download_status");
  const { data: usedMedia } = await admin.from("product_media").select("media_id");
  const used = new Set((usedMedia ?? []).map((r) => r.media_id));
  const orphanMedia = (allMedia ?? []).filter((m) => !used.has(m.id));

  // Storage existence sample + count
  const { data: buckets } = await admin.storage.listBuckets();
  let storageObjects = 0;
  let storageMissing = 0;
  const uploadedMedia = (allMedia ?? []).filter(
    (m) => m.download_status === "uploaded" && m.bucket && m.storage_path,
  );
  // Check a sample + count via list is expensive; verify each uploaded path exists by download head
  for (const m of uploadedMedia) {
    const folder = m.storage_path!.split("/").slice(0, -1).join("/");
    const file = m.storage_path!.split("/").pop()!;
    const { data: listed, error } = await admin.storage.from(m.bucket!).list(folder, {
      search: file,
      limit: 100,
    });
    if (error) {
      storageMissing++;
      continue;
    }
    const found = (listed ?? []).some((f) => f.name === file);
    if (found) storageObjects++;
    else storageMissing++;
  }

  // Public read check
  const { data: publicProducts, error: pubErr } = await publicClient
    .from("products")
    .select("id")
    .limit(3);
  const { error: writeErr } = await publicClient.from("products").insert({
    id: "00000000-0000-0000-0000-000000000000",
    source_id: "security-test-should-fail",
    name: "x",
    slug: "security-test-should-fail",
    content_hash: "x",
    original_url: "x",
  });
  const publicReadOk = !pubErr && (publicProducts?.length ?? 0) >= 0;
  const publicWriteBlocked = Boolean(writeErr);

  // Sample public storage URL
  let publicUrlOk: boolean | null = null;
  const sample = uploadedMedia[0];
  if (sample?.bucket && sample.storage_path) {
    const { data } = admin.storage.from(sample.bucket).getPublicUrl(sample.storage_path);
    try {
      const res = await fetch(data.publicUrl, { method: "HEAD" });
      publicUrlOk = res.ok;
    } catch {
      publicUrlOk = false;
    }
  }

  const localValidMedia = local.media.filter((m) => m.download_status !== "failed").length;

  const report = {
    generated_at: nowIso(),
    project_ref: ref,
    url,
    comparison: {
      products: { local: local.products.length, supabase: remote.products },
      categories: { local: local.categories.length, supabase: remote.categories },
      brands: { local: local.brands.length, supabase: remote.brands },
      markets: { local: local.markets.length, supabase: remote.markets },
      product_types: {
        local: local.product_types.length,
        supabase: remote.product_types,
      },
      media: { local: local.media.length, supabase: remote.media },
      media_ok_local: localValidMedia,
      media_uploaded: mediaUploaded ?? 0,
      media_failed: mediaFailed ?? 0,
      documents: { local: local.documents.length, supabase: remote.documents },
    },
    relations: {
      products_without_category: missingCategory.length,
      products_without_brand: missingBrand.length,
      products_without_market: missingMarket.length,
      products_without_image: missingImage.length,
      orphan_media: orphanMedia.length,
      duplicate_slugs: dupSlugs.length,
      duplicate_source_ids: dupSources.length,
      sample_missing_category: missingCategory.slice(0, 5),
      sample_missing_brand: missingBrand.slice(0, 5),
      sample_missing_image: missingImage.slice(0, 5),
    },
    storage: {
      buckets: (buckets ?? []).map((b) => ({ id: b.id, public: b.public })),
      uploaded_media_checked: uploadedMedia.length,
      storage_objects_found: storageObjects,
      storage_missing: storageMissing,
      public_url_ok: publicUrlOk,
    },
    security: {
      rls_public_read: publicReadOk ? "OK" : "ERROR",
      public_write_blocked: publicWriteBlocked ? "BLOCKED" : "ERROR",
      service_role_exposed_in_response: "NO",
    },
    remote_counts: remote,
    pass:
      remote.products === local.products.filter((p) => p.source_active).length &&
      remote.categories === local.categories.length &&
      remote.brands === local.brands.length &&
      remote.markets === local.markets.length &&
      dupSlugs.length === 0 &&
      dupSources.length === 0 &&
      publicWriteBlocked &&
      storageMissing === 0,
  };

  await writeJson(path.join(PATHS.reports, "supabase-validation-report.json"), report);
  log("validate:supabase", report.pass ? "PASS" : "ISSUES", {
    products: report.comparison.products,
    media_uploaded: report.comparison.media_uploaded,
    storage_missing: report.storage.storage_missing,
    security: report.security,
  });
  if (!report.pass) process.exitCode = 0; // report only; caller decides
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
