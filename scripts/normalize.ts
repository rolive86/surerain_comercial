import path from "node:path";
import {
  CATEGORY_LABELS,
  MARKET_LABELS,
  PATHS,
  STORAGE_BUCKETS,
} from "../src/config.js";
import {
  extractDescriptionBullets,
} from "../src/lib/catalog-parser.js";
import {
  contentHash,
  ensureDir,
  log,
  newId,
  nowIso,
  readJson,
  slugify,
  writeJson,
} from "../src/lib/io.js";
import type {
  MediaRecord,
  NormalizedAttribute,
  NormalizedBrand,
  NormalizedCategory,
  NormalizedDataset,
  NormalizedDocument,
  NormalizedMarket,
  NormalizedProduct,
  NormalizedProductType,
  RawCatalogSnapshot,
} from "../src/types.js";

type StableIds = {
  products: Record<string, string>;
  categories: Record<string, string>;
  brands: Record<string, string>;
  markets: Record<string, string>;
  product_types: Record<string, string>;
  attributes: Record<string, string>;
  media_by_url: Record<string, string>;
  documents: Record<string, string>;
  variants: Record<string, string>;
};

const IDS_PATH = path.join(PATHS.checkpoints, "stable-ids.json");
const PREV_DATASET_PATH = path.join(PATHS.dataNormalized, "dataset.json");

function stableId(
  map: Record<string, string>,
  key: string,
): string {
  if (!map[key]) map[key] = newId();
  return map[key]!;
}

function guessMime(url: string): string | null {
  const lower = url.toLowerCase().split("?")[0] ?? "";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return null;
}

function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return decodeURIComponent(path.basename(u.pathname)) || "file";
  } catch {
    return path.basename(url) || "file";
  }
}

function storagePathFor(
  bucket: string,
  filename: string,
): string {
  return `${bucket}/${filename}`;
}

function titleCaseTipo(slug: string): string {
  const map: Record<string, string> = {
    impacto: "Impacto",
    emergente: "Emergente",
    oscilante: "Oscilante",
    rotor: "Rotor",
    accesorio: "Accesorio",
    otro: "Otro",
  };
  return map[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

function inferSku(name: string, specs: Array<{ label: string; value: string }>): string | null {
  for (const row of specs) {
    if (/^(sku|código|codigo|code|modelo)$/i.test(row.label)) {
      return row.value.trim() || null;
    }
  }
  // Common pattern: codes like VYR-26, ASSR-8427, RPS75, PW-2195
  const m = name.match(/\b([A-Z]{1,8}[-\s]?\d{2,6}[A-Z0-9\-]*)\b/);
  if (m) return m[1]!.replace(/\s+/g, "-");
  return null;
}

async function main() {
  log("normalize", "Normalizing raw catalog into ecommerce model");
  await ensureDir(PATHS.dataNormalized);
  await ensureDir(PATHS.checkpoints);

  const raw = await readJson<RawCatalogSnapshot>(
    path.join(PATHS.dataRaw, "catalog.raw.json"),
  );
  if (!raw) throw new Error("Missing data/raw/catalog.raw.json — run npm run extract first");

  const idsLoaded = (await readJson<StableIds>(IDS_PATH)) ?? {
    products: {},
    categories: {},
    brands: {},
    markets: {},
    product_types: {},
    attributes: {},
    media_by_url: {},
    documents: {},
    variants: {},
  };
  const ids: StableIds = {
    products: idsLoaded.products ?? {},
    categories: idsLoaded.categories ?? {},
    brands: idsLoaded.brands ?? {},
    markets: idsLoaded.markets ?? {},
    product_types: idsLoaded.product_types ?? {},
    attributes: idsLoaded.attributes ?? {},
    media_by_url: idsLoaded.media_by_url ?? {},
    documents: idsLoaded.documents ?? {},
    variants: idsLoaded.variants ?? {},
  };

  const previous = await readJson<NormalizedDataset>(PREV_DATASET_PATH);
  const previousBySource = new Map(
    (previous?.products ?? []).map((p) => [p.source_id, p]),
  );
  const previousMediaByUrl = new Map(
    (previous?.media ?? []).map((m) => [m.original_url, m]),
  );

  const runId = newId();
  const ts = nowIso();

  const categories: NormalizedCategory[] = [];
  const brands: NormalizedBrand[] = [];
  const markets: NormalizedMarket[] = [];
  const productTypes: NormalizedProductType[] = [];
  const attributes: NormalizedAttribute[] = [];
  const media: MediaRecord[] = [];
  const documents: NormalizedDocument[] = [];
  const products: NormalizedProduct[] = [];
  const productCategories: NormalizedDataset["product_categories"] = [];
  const productMarkets: NormalizedDataset["product_markets"] = [];
  const productMedia: NormalizedDataset["product_media"] = [];
  const productAttributeValues: NormalizedDataset["product_attribute_values"] = [];
  const productVariants: NormalizedDataset["product_variants"] = [];

  const attrIndex = new Map<string, NormalizedAttribute>();
  function ensureAttribute(
    name: string,
    dataType: NormalizedAttribute["data_type"] = "text",
    filterable = true,
  ): NormalizedAttribute {
    const slug = slugify(name);
    if (attrIndex.has(slug)) return attrIndex.get(slug)!;
    const id = stableId(ids.attributes, slug);
    const attr: NormalizedAttribute = {
      id,
      name,
      slug,
      data_type: dataType,
      unit: null,
      filterable,
    };
    attrIndex.set(slug, attr);
    attributes.push(attr);
    return attr;
  }

  // Seed known taxonomies from source
  const categorySlugs = [
    ...new Set(raw.products.map((p) => p.category_slug).filter(Boolean)),
  ] as string[];
  for (const [i, slug] of categorySlugs.entries()) {
    categories.push({
      id: stableId(ids.categories, slug),
      parent_id: null,
      name: CATEGORY_LABELS[slug] ?? slug,
      slug,
      description: null,
      image_id: null,
      sort_order: i,
      active: true,
      source_id: `category:${slug}`,
    });
  }

  const brandNames = [
    ...new Set(raw.products.map((p) => p.brand_name).filter(Boolean)),
  ] as string[];
  for (const name of brandNames.sort()) {
    const slug = slugify(name);
    brands.push({
      id: stableId(ids.brands, slug),
      name,
      slug,
      description: null,
      logo_media_id: null,
      active: true,
      source_id: `brand:${slug}`,
    });
  }

  const marketSlugs = [
    ...new Set(raw.products.flatMap((p) => p.markets)),
  ];
  for (const slug of marketSlugs) {
    markets.push({
      id: stableId(ids.markets, slug),
      name: MARKET_LABELS[slug] ?? slug,
      slug,
      description: null,
      source_id: `market:${slug}`,
    });
  }

  const typeSlugs = [
    ...new Set(
      raw.products.map((p) => p.product_type_slug).filter(Boolean),
    ),
  ] as string[];
  for (const slug of typeSlugs) {
    productTypes.push({
      id: stableId(ids.product_types, slug),
      name: titleCaseTipo(slug),
      slug,
      source_id: `type:${slug}`,
    });
  }

  // Core attributes observed / useful
  ensureAttribute("Marca", "text", true);
  ensureAttribute("Tipo de Producto", "text", true);
  ensureAttribute("Característica", "text", false);
  ensureAttribute("Medidas", "text", true);
  ensureAttribute("Descripción original", "text", false);

  let productsNew = 0;
  let productsModified = 0;
  let productsUnchanged = 0;
  const seenSourceIds = new Set<string>();

  // Unique slugs
  const usedSlugs = new Set<string>();
  function uniqueSlug(base: string, sourceId: string): string {
    const cleanBase = base || "producto";
    if (!usedSlugs.has(cleanBase)) {
      usedSlugs.add(cleanBase);
      return cleanBase;
    }
    const fromSource = slugify(sourceId.replace(/^img:/, "")) || "dup";
    let candidate = `${cleanBase}-${fromSource}`;
    let n = 2;
    while (usedSlugs.has(candidate)) {
      candidate = `${cleanBase}-${fromSource}-${n++}`;
    }
    usedSlugs.add(candidate);
    return candidate;
  }

  for (const [index, rawProduct] of raw.products.entries()) {
    seenSourceIds.add(rawProduct.source_id);
    const productId = stableId(ids.products, rawProduct.source_id);
    const prev = previousBySource.get(rawProduct.source_id);
    const firstSeen = prev?.first_seen_at ?? ts;
    const changed = !prev || prev.content_hash !== rawProduct.content_hash;
    if (!prev) productsNew++;
    else if (changed) productsModified++;
    else productsUnchanged++;

    const brand = rawProduct.brand_name
      ? brands.find((b) => b.name === rawProduct.brand_name) ?? null
      : null;
    const category = rawProduct.category_slug
      ? categories.find((c) => c.slug === rawProduct.category_slug) ?? null
      : null;
    const pType = rawProduct.product_type_slug
      ? productTypes.find((t) => t.slug === rawProduct.product_type_slug) ?? null
      : null;

    let featuredImageId: string | null = null;
    if (rawProduct.image_url) {
      const mediaId = stableId(ids.media_by_url, rawProduct.image_url);
      const filename = filenameFromUrl(rawProduct.image_url);
      const localPath = path.join("media", "products", filename).replace(/\\/g, "/");
      const prevMedia = previousMediaByUrl.get(rawProduct.image_url);
      const record: MediaRecord = {
        id: mediaId,
        type: "image",
        role_hint: "featured",
        filename,
        mime_type: prevMedia?.mime_type ?? guessMime(rawProduct.image_url),
        original_url: rawProduct.image_url,
        local_path: localPath,
        storage_path: storagePathFor(STORAGE_BUCKETS.productImages, filename),
        width: prevMedia?.width ?? null,
        height: prevMedia?.height ?? null,
        file_size: prevMedia?.file_size ?? null,
        checksum: prevMedia?.checksum ?? null,
        alt_text: rawProduct.image_alt,
        download_status: prevMedia?.download_status ?? "pending",
        error: prevMedia?.error,
        created_at: prevMedia?.created_at ?? ts,
      };
      if (!media.find((m) => m.id === mediaId)) media.push(record);
      featuredImageId = mediaId;
      productMedia.push({
        product_id: productId,
        media_id: mediaId,
        role: "featured",
        sort_order: 0,
      });
    }

    const docIds: string[] = [];
    if (rawProduct.ficha_url) {
      const mediaId = stableId(ids.media_by_url, rawProduct.ficha_url);
      const filename = filenameFromUrl(rawProduct.ficha_url);
      const localPath = path
        .join("media", "documents", filename)
        .replace(/\\/g, "/");
      const prevMedia = previousMediaByUrl.get(rawProduct.ficha_url);
      if (!media.find((m) => m.id === mediaId)) {
        media.push({
          id: mediaId,
          type: "image",
          role_hint: "technical",
          filename,
          mime_type: prevMedia?.mime_type ?? guessMime(rawProduct.ficha_url),
          original_url: rawProduct.ficha_url,
          local_path: localPath,
          storage_path: storagePathFor(
            STORAGE_BUCKETS.productDocuments,
            filename,
          ),
          width: prevMedia?.width ?? null,
          height: prevMedia?.height ?? null,
          file_size: prevMedia?.file_size ?? null,
          checksum: prevMedia?.checksum ?? null,
          alt_text: `Ficha técnica — ${rawProduct.name}`,
          download_status: prevMedia?.download_status ?? "pending",
          error: prevMedia?.error,
          created_at: prevMedia?.created_at ?? ts,
        });
      }
      productMedia.push({
        product_id: productId,
        media_id: mediaId,
        role: "technical",
        sort_order: 1,
      });
      const docId = stableId(
        ids.documents,
        `${rawProduct.source_id}|${rawProduct.ficha_url}`,
      );
      documents.push({
        id: docId,
        product_id: productId,
        name: `Ficha técnica — ${rawProduct.name}`,
        document_type: "ficha_tecnica",
        original_url: rawProduct.ficha_url,
        local_path: localPath,
        storage_path: storagePathFor(
          STORAGE_BUCKETS.productDocuments,
          filename,
        ),
        mime_type: prevMedia?.mime_type ?? guessMime(rawProduct.ficha_url),
        checksum: prevMedia?.checksum ?? null,
        media_id: mediaId,
      });
      docIds.push(docId);
    }

    // Specs → attributes
    for (const row of rawProduct.specs_rows) {
      const attr = ensureAttribute(row.label || "Spec", "text", true);
      productAttributeValues.push({
        product_id: productId,
        attribute_id: attr.id,
        value_text: row.value,
        value_number: null,
        value_boolean: null,
        value_json: null,
      });
    }

    // Description bullets as characteristic attributes (keep original description intact)
    const bullets = extractDescriptionBullets(rawProduct.description);
    if (bullets.length) {
      const attr = ensureAttribute("Característica", "text", false);
      for (const bullet of bullets) {
        productAttributeValues.push({
          product_id: productId,
          attribute_id: attr.id,
          value_text: bullet,
          value_number: null,
          value_boolean: null,
          value_json: null,
        });
      }
    }

    // Preserve full original description also as attribute for audit
    if (rawProduct.description.trim()) {
      const attr = ensureAttribute("Descripción original", "text", false);
      productAttributeValues.push({
        product_id: productId,
        attribute_id: attr.id,
        value_text: rawProduct.description,
        value_number: null,
        value_boolean: null,
        value_json: null,
      });
    }

    if (category) {
      productCategories.push({
        product_id: productId,
        category_id: category.id,
        is_primary: true,
      });
    }

    for (const mSlug of rawProduct.markets) {
      const market = markets.find((m) => m.slug === mSlug);
      if (market) {
        productMarkets.push({ product_id: productId, market_id: market.id });
      }
    }

    const slug = uniqueSlug(rawProduct.slug || slugify(rawProduct.name), rawProduct.source_id);
    const sku = inferSku(rawProduct.name, rawProduct.specs_rows);

    const product: NormalizedProduct = {
      id: productId,
      source_id: rawProduct.source_id,
      sku,
      name: rawProduct.name,
      slug,
      short_description: rawProduct.description
        ? rawProduct.description.slice(0, 180)
        : null,
      description: rawProduct.description,
      status: "active",
      brand_id: brand?.id ?? null,
      product_type_id: pType?.id ?? null,
      original_url: rawProduct.original_url,
      featured_image_id: featuredImageId,
      seo_title: rawProduct.name,
      seo_description: rawProduct.description
        ? rawProduct.description.slice(0, 160)
        : null,
      source_created_at: null,
      source_updated_at: raw.fetched_at,
      source_active: true,
      first_seen_at: firstSeen,
      last_seen_at: ts,
      content_hash: rawProduct.content_hash,
      purchasable: false,
      featured: false,
      published: true,
      sort_order: index,
      created_at: prev?.created_at ?? ts,
      updated_at: ts,
      raw_ref: `data/raw/products/${rawProduct.source_id.replace(/[:/\\]/g, "_")}.json`,
      category_ids: category ? [category.id] : [],
      primary_category_id: category?.id ?? null,
      market_ids: rawProduct.markets
        .map((s) => markets.find((m) => m.slug === s)?.id)
        .filter(Boolean) as string[],
      media_ids: productMedia
        .filter((pm) => pm.product_id === productId)
        .map((pm) => ({
          media_id: pm.media_id,
          role: pm.role,
          sort_order: pm.sort_order,
        })),
      document_ids: docIds,
      attribute_values: [],
    };
    product.attribute_values = productAttributeValues.filter(
      (v) => v.product_id === productId,
    );
    products.push(product);

    // Default single variant (no invented ecommerce data)
    productVariants.push({
      id: stableId(ids.variants, `${rawProduct.source_id}|default`),
      product_id: productId,
      sku,
      name: "Default",
      active: true,
      sort_order: 0,
    });
  }

  // Mark products missing from source
  let missing = 0;
  if (previous) {
    for (const old of previous.products) {
      if (!seenSourceIds.has(old.source_id)) {
        missing++;
        products.push({
          ...old,
          source_active: false,
          status: old.status,
          last_seen_at: old.last_seen_at,
          updated_at: ts,
        });
      }
    }
  }

  const dataset: NormalizedDataset = {
    generated_at: ts,
    products,
    categories,
    brands,
    markets,
    product_types: productTypes,
    media,
    documents,
    attributes,
    product_categories: productCategories,
    product_markets: productMarkets,
    product_media: productMedia,
    product_attribute_values: productAttributeValues,
    product_variants: productVariants,
    prices: [],
    inventory: [],
    sync_meta: {
      run_id: runId,
      source_url: raw.source_url,
      products_seen: seenSourceIds.size,
      products_new: productsNew,
      products_modified: productsModified,
      products_unchanged: productsUnchanged,
      products_missing_from_source: missing,
    },
  };

  await writeJson(IDS_PATH, ids);
  await writeJson(PREV_DATASET_PATH, dataset);
  await writeJson(path.join(PATHS.dataNormalized, "products.json"), products);
  await writeJson(path.join(PATHS.dataNormalized, "categories.json"), categories);
  await writeJson(path.join(PATHS.dataNormalized, "brands.json"), brands);
  await writeJson(path.join(PATHS.dataNormalized, "markets.json"), markets);
  await writeJson(path.join(PATHS.dataNormalized, "attributes.json"), attributes);
  await writeJson(path.join(PATHS.dataNormalized, "media.json"), media);
  await writeJson(path.join(PATHS.dataNormalized, "documents.json"), documents);
  await writeJson(path.join(PATHS.dataNormalized, "product_types.json"), productTypes);

  // Content hash of normalized export for integrity
  await writeJson(path.join(PATHS.dataNormalized, "dataset.meta.json"), {
    generated_at: ts,
    content_hash: contentHash({
      products: products.map((p) => ({
        source_id: p.source_id,
        content_hash: p.content_hash,
      })),
    }),
    sync_meta: dataset.sync_meta,
    counts: {
      products: products.length,
      categories: categories.length,
      brands: brands.length,
      markets: markets.length,
      media: media.length,
      documents: documents.length,
      attributes: attributes.length,
    },
  });

  log("normalize", "Normalize complete", dataset.sync_meta);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
