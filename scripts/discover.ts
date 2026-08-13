import path from "node:path";
import {
  BASE_URL,
  CATALOG_URL,
  PATHS,
  SITE_PAGES,
} from "../src/config.js";
import {
  parseCatalogHtml,
  summarizeCatalog,
} from "../src/lib/catalog-parser.js";
import {
  ensureDir,
  fetchWithRetry,
  log,
  nowIso,
  writeJson,
  writeText,
} from "../src/lib/io.js";
import type { DiscoveryReport } from "../src/types.js";

const PROBE_URLS = [
  "/robots.txt",
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/catalogo",
  "/catalogo.html",
  "/products.json",
  "/data/products.json",
  "/assets/products.json",
  "/catalogo.json",
  "/api/products",
  "/wp-json/wp/v2/product",
  "/wp-json/wc/v3/products",
  "/assets/site.js",
  "/assets/site.css",
  "/assets/tailwind.css",
];

async function main() {
  log("discover", "Starting technical discovery");
  await ensureDir(PATHS.reports);
  await ensureDir(PATHS.dataRaw);

  const endpoints: DiscoveryReport["endpoints_probed"] = [];
  for (const p of PROBE_URLS) {
    const url = p.startsWith("http") ? p : `${BASE_URL}${p}`;
    const res = await fetchWithRetry(url, { accept: "*/*" });
    endpoints.push({
      url,
      status: res.status,
      content_type: res.contentType,
      notes: res.error,
    });
    log("discover", `probed ${url}`, { status: res.status });
  }

  const catalogRes = await fetchWithRetry(CATALOG_URL, {
    accept: "text/html",
  });
  if (!catalogRes.ok) {
    throw new Error(`Failed to fetch catalog: HTTP ${catalogRes.status}`);
  }
  const html = catalogRes.body.toString("utf8");
  await writeText(path.join(PATHS.dataRaw, "catalogo.source.html"), html);

  const snapshot = parseCatalogHtml(html, {
    sourceUrl: CATALOG_URL,
    finalUrl: catalogRes.finalUrl,
    fetchedAt: nowIso(),
  });
  const summary = summarizeCatalog(snapshot);

  // Probe site pages
  const sitePages: string[] = [];
  for (const p of SITE_PAGES) {
    const url = `${BASE_URL}${p}`;
    const res = await fetchWithRetry(url, { accept: "text/html" });
    if (res.ok) sitePages.push(res.finalUrl || url);
  }

  const report: DiscoveryReport = {
    generated_at: nowIso(),
    base_url: BASE_URL,
    technology: {
      framework: "Static HTML site (post-WordPress migration)",
      rendering: "Server delivers full catalog HTML with all product cards embedded",
      filtering: "Client-side only via assets/site.js (dropdowns + text search)",
      product_ui:
        "Modal openProductModal(name, description, specsHtml); deep-link ?producto=slug",
    },
    endpoints_probed: endpoints,
    primary_source: {
      url: CATALOG_URL,
      type: "embedded-html-product-cards",
      reason:
        "No public JSON/API/JSON-LD catalog endpoint found. All 420 products are present in catalogo HTML as .product-card nodes with data-* attributes and openProductModal payload.",
    },
    secondary_sources: [
      "https://surerain.com/assets/site.js (filter + modal behavior)",
      "https://surerain.com/assets/productos-importados/* (featured images)",
      "https://surerain.com/assets/productos-fichas/* (technical sheet images)",
      "https://surerain.com/robots.txt",
    ],
    catalog: {
      published_total: snapshot.published_total,
      categories: summary.categories,
      brands: summary.brands,
      markets: summary.markets,
      product_types: summary.product_types,
      cards_detected: snapshot.product_count,
      with_ficha: summary.with_ficha,
      with_description: summary.with_description,
      unique_images: summary.unique_images,
      duplicate_names: summary.duplicate_names,
    },
    asset_roots: [
      "assets/productos-importados/",
      "assets/productos-fichas/",
      "assets/logos/",
      "assets/hero/",
      "assets/site.css",
      "assets/tailwind.css",
      "assets/site.js",
    ],
    site_pages: sitePages,
    recommended_extraction_method:
      "Parse .product-card elements from catalog HTML as primary structured source. Download referenced product images and data-ficha technical sheets. Mirror static site pages/assets for offline reference. Do not scrape WordPress/shop URLs (explicitly retired in robots.txt).",
    notes: [
      "sitemap.xml returns 404",
      "No wp-json / WooCommerce / Next.js / Supabase public catalog API detected",
      "Specs tables mostly contain Marca + Tipo de Producto (markets); rich specs live in description text",
      "Product names are not globally unique; source_id derived from image filename",
      "Fichas técnicas are images (webp/jpg), not PDFs",
      `Published claim: ${snapshot.published_claim_text ?? "n/a"}`,
    ],
  };

  await writeJson(path.join(PATHS.reports, "discovery-report.json"), report);
  await writeJson(path.join(PATHS.dataRaw, "discovery-snapshot-meta.json"), {
    fetched_at: snapshot.fetched_at,
    published_total: snapshot.published_total,
    product_count: snapshot.product_count,
    html_sha256: snapshot.html_sha256,
    html_bytes: snapshot.html_bytes,
    summary,
  });

  log("discover", "Discovery complete", {
    published_total: snapshot.published_total,
    cards: snapshot.product_count,
    report: "reports/discovery-report.json",
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
