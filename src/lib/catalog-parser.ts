import * as cheerio from "cheerio";
import {
  BASE_URL,
  CATALOG_URL,
  CATEGORY_LABELS,
  MARKET_LABELS,
} from "../config.js";
import { absoluteUrl, contentHash, nowIso, sha256, slugify } from "./io.js";
import type { RawCatalogSnapshot, RawProductCard } from "../types.js";

function decodeHtmlAttr(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'");
}

/** Parse JS string-literal args of openProductModal('a','b','c') */
export function parseOpenProductModalArgs(onclick: string): string[] | null {
  const start = onclick.indexOf("openProductModal(");
  if (start < 0) return null;
  let i = start + "openProductModal(".length;
  const args: string[] = [];
  while (i < onclick.length) {
    while (i < onclick.length && /[\s,]/.test(onclick[i]!)) i++;
    if (i >= onclick.length || onclick[i] === ")") break;
    const q = onclick[i];
    if (q !== "'" && q !== '"') break;
    i++;
    let s = "";
    while (i < onclick.length) {
      if (onclick[i] === "\\" && i + 1 < onclick.length) {
        s += onclick[i + 1];
        i += 2;
        continue;
      }
      if (onclick[i] === q) {
        i++;
        break;
      }
      s += onclick[i++];
    }
    args.push(s);
  }
  return args;
}

export function parseSpecsRows(
  specsHtml: string,
): Array<{ label: string; value: string }> {
  if (!specsHtml?.trim()) return [];
  const $ = cheerio.load(`<table><tbody>${specsHtml}</tbody></table>`);
  const rows: Array<{ label: string; value: string }> = [];
  $("tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 2) return;
    const label = $(tds[0]).text().trim();
    const value = $(tds[1]).text().trim();
    if (label || value) rows.push({ label, value });
  });
  return rows;
}

export function sourceIdFromImage(imageUrl: string | null, index: number, name: string): string {
  if (imageUrl) {
    const file = imageUrl.split("/").pop()?.split("?")[0] ?? "";
    const base = file.replace(/\.[^.]+$/, "");
    if (base) return `img:${base}`;
  }
  return `idx:${index}:${slugify(name)}`;
}

export function extractPublishedTotal(html: string): {
  total: number | null;
  claim: string | null;
} {
  const m =
    html.match(/(\d+)\s+productos?\s+(?:en\s+\d+\s+categorías|mostrados)/i) ||
    html.match(/Catálogo Sure Rain\s*[—-]\s*(\d+)\s+productos/i) ||
    html.match(/\|?\s*(\d+)\s+productos\s+de\s+riego/i);
  if (!m) return { total: null, claim: null };
  return { total: Number(m[1]), claim: m[0] };
}

export function parseCatalogHtml(
  html: string,
  meta: { sourceUrl: string; finalUrl: string; fetchedAt?: string },
): RawCatalogSnapshot {
  const $ = cheerio.load(html);
  const published = extractPublishedTotal(html);
  const products: RawProductCard[] = [];

  $(".product-card").each((index, el) => {
    const card = $(el);
    const name =
      card.find("h4").first().text().trim() ||
      card.find("img").attr("alt")?.trim() ||
      `producto-${index + 1}`;
    const categorySlug = card.attr("data-category")?.trim() || null;
    const brandName = card.attr("data-marca")?.trim() || null;
    const productTypeSlug = card.attr("data-tipo")?.trim() || null;
    const markets = (card.attr("data-vertical") || "")
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const fichaRel = card.attr("data-ficha")?.trim() || null;
    const img = card.find("img").first();
    const imageRel = img.attr("src")?.trim() || null;
    const imageAlt = img.attr("alt")?.trim() || name;
    const chipLabel = card.find(".chip").first().text().trim() || null;
    const onclickRaw = card.attr("onclick") || "";
    const args = parseOpenProductModalArgs(decodeHtmlAttr(onclickRaw)) ?? [];
    const modalName = args[0]?.trim() || name;
    const description = args[1] ?? "";
    const specsHtml = args[2] ?? "";
    const specsRows = parseSpecsRows(specsHtml);
    const imageUrl = imageRel ? absoluteUrl(BASE_URL + "/", imageRel) : null;
    const fichaUrl = fichaRel ? absoluteUrl(BASE_URL + "/", fichaRel) : null;
    const sourceId = sourceIdFromImage(imageUrl, index, modalName);
    const slug = slugify(modalName);
    const originalUrl = `${CATALOG_URL}?producto=${slug}`;
    const outerHtml = $.html(el) ?? "";

    const payloadForHash = {
      name: modalName,
      categorySlug,
      brandName,
      productTypeSlug,
      markets,
      imageUrl,
      fichaUrl,
      description,
      specsRows,
    };

    products.push({
      source_index: index,
      source_id: sourceId,
      name: modalName,
      slug,
      category_slug: categorySlug,
      brand_name: brandName,
      product_type_slug: productTypeSlug,
      markets,
      image_url: imageUrl,
      image_alt: imageAlt,
      ficha_url: fichaUrl,
      description,
      specs_html: specsHtml,
      specs_rows: specsRows,
      chip_label: chipLabel,
      original_url: originalUrl,
      outer_html: outerHtml,
      onclick_raw: onclickRaw,
      content_hash: contentHash(payloadForHash),
      provenance: {
        source_url: meta.sourceUrl,
        source_page: meta.finalUrl,
        source_selector: `.product-card:nth-of-type(${index + 1})`,
        extracted_at: meta.fetchedAt ?? nowIso(),
        raw_fields: [
          "data-category",
          "data-marca",
          "data-tipo",
          "data-vertical",
          "data-ficha",
          "img[src]",
          "h4",
          "openProductModal(name,description,specsHtml)",
        ],
      },
    });
  });

  return {
    fetched_at: meta.fetchedAt ?? nowIso(),
    source_url: meta.sourceUrl,
    final_url: meta.finalUrl,
    published_total: published.total,
    published_claim_text: published.claim,
    html_sha256: sha256(html),
    html_bytes: Buffer.byteLength(html, "utf8"),
    product_count: products.length,
    products,
  };
}

export function summarizeCatalog(snapshot: RawCatalogSnapshot) {
  const nameCount = new Map<string, number>();
  for (const p of snapshot.products) {
    nameCount.set(p.name, (nameCount.get(p.name) ?? 0) + 1);
  }
  return {
    categories: [...new Set(snapshot.products.map((p) => p.category_slug).filter(Boolean))] as string[],
    brands: [...new Set(snapshot.products.map((p) => p.brand_name).filter(Boolean))] as string[],
    markets: [
      ...new Set(snapshot.products.flatMap((p) => p.markets)),
    ],
    product_types: [
      ...new Set(
        snapshot.products.map((p) => p.product_type_slug).filter(Boolean),
      ),
    ] as string[],
    with_ficha: snapshot.products.filter((p) => p.ficha_url).length,
    with_description: snapshot.products.filter((p) => p.description.trim()).length,
    unique_images: new Set(snapshot.products.map((p) => p.image_url).filter(Boolean)).size,
    duplicate_names: [...nameCount.entries()]
      .filter(([, n]) => n > 1)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    category_labels: CATEGORY_LABELS,
    market_labels: MARKET_LABELS,
  };
}

/** Extract characteristic bullets from free-text descriptions into attribute candidates. */
export function extractDescriptionBullets(description: string): string[] {
  if (!description?.trim()) return [];
  const cleaned = description
    .replace(/^CARACTER[ÍI]STICAS\s*:?\s*/i, "")
    .replace(/^Características\s*(generales)?\s*:?\s*/i, "")
    .trim();
  const parts = cleaned
    .split(/(?:^|[\n\r]|[•–\-])\s+|(?<=\.)\s+(?=[A-ZÁÉÍÓÚÜÑ])/)
    .map((s) => s.replace(/^[•–\-]\s*/, "").trim())
    .filter((s) => s.length > 2 && s.length < 300);
  // Prefer explicit bullet split
  const bulletSplit = cleaned
    .split(/[•]/)
    .map((s) => s.replace(/^[\s–\-]+/, "").trim())
    .filter((s) => s.length > 2);
  if (bulletSplit.length >= 2) return bulletSplit;
  const dashSplit = cleaned
    .split(/(?:^|\s)[–\-]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  if (dashSplit.length >= 2) return dashSplit;
  return parts.slice(0, 20);
}
