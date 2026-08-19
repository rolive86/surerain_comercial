/**
 * Map catalog source_id → tango.cod_articulo into public.product_map.
 * Writes reports/product-map.md. Does not auto-confirm low confidence.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { ROOT } from "../../src/config.js";
import type { Database, Json } from "../../src/types/commercial.types.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

const NAME_OK = 0.75;
const NAME_WEAK = 0.55;

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

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalizeName(value).split(" ").filter((w) => w.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / new Set([...a, ...b]).size;
}

type CatalogProduct = { source_id: string; name: string; sku: string | null };
type TangoArt = { cod_articulo: string; cod_barra: string | null; descripcion: string | null };
type Candidate = {
  source_id: string;
  catalog_name: string;
  sku: string | null;
  cod_articulo: string;
  barcode: string | null;
  tango_desc: string | null;
  match_method: "barcode" | "nombre" | "sku";
  confidence: number;
};

async function fetchAllCatalog(url: string, key: string): Promise<CatalogProduct[]> {
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const out: CatalogProduct[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select("source_id, name, sku")
      .eq("published", true)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as CatalogProduct[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

async function main() {
  const catalogUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const catalogKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const commercialUrl = requireEnv("NEXT_PUBLIC_COMMERCIAL_SUPABASE_URL");
  const service = requireEnv("COMMERCIAL_SUPABASE_SERVICE_ROLE_KEY");

  const commercial = createClient<Database>(commercialUrl, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const catalog = await fetchAllCatalog(catalogUrl, catalogKey);
  const { data: artsJson, error: artsErr } = await commercial.rpc("tango_staging_fetch", {
    p_entity: "articulos",
  });
  if (artsErr) throw new Error(artsErr.message);
  const artsRaw = (artsJson as Json[] | null) ?? [];
  if (!Array.isArray(artsRaw)) throw new Error("articulos fetch is not an array");

  const { data: specsJson, error: specsErr } = await commercial.rpc("tango_staging_fetch", {
    p_entity: "articulos_specs",
  });
  if (specsErr) throw new Error(specsErr.message);
  const specsRaw = Array.isArray(specsJson) ? (specsJson as Json[]) : [];

  const tango: TangoArt[] = [];
  const seen = new Set<string>();
  for (const raw of [...artsRaw, ...specsRaw]) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const cod = asText(r.cod_articulo);
    if (!cod || seen.has(cod)) continue;
    seen.add(cod);
    tango.push({
      cod_articulo: cod,
      cod_barra: asText(r.cod_barra),
      descripcion: asText(r.descripcion),
    });
  }

  const byBarcode = new Map<string, TangoArt>();
  const byCode = new Map<string, TangoArt>();
  for (const a of tango) {
    byCode.set(a.cod_articulo.toLowerCase(), a);
    if (a.cod_barra) byBarcode.set(a.cod_barra.replace(/\s+/g, "").toLowerCase(), a);
  }

  const candidates: Candidate[] = [];
  const unmatched: CatalogProduct[] = [];

  for (const p of catalog) {
    const sku = p.sku?.trim() || null;
    const skuKey = sku?.replace(/\s+/g, "").toLowerCase() ?? null;
    let hit: TangoArt | null = null;
    let method: Candidate["match_method"] | null = null;
    let confidence = 0;

    if (skuKey && byBarcode.has(skuKey)) {
      hit = byBarcode.get(skuKey)!;
      method = "barcode";
      confidence = 1;
    } else if (skuKey && byCode.has(skuKey)) {
      hit = byCode.get(skuKey)!;
      method = "sku";
      confidence = 0.99;
    } else {
      const pt = tokens(p.name);
      let best = 0;
      let bestArt: TangoArt | null = null;
      for (const a of tango) {
        const score = jaccard(pt, tokens(a.descripcion ?? ""));
        if (score > best) {
          best = score;
          bestArt = a;
        }
      }
      if (bestArt && best >= NAME_WEAK) {
        hit = bestArt;
        method = "nombre";
        confidence = Math.round(best * 1000) / 1000;
      }
    }

    if (!hit || !method) {
      unmatched.push(p);
      continue;
    }
    candidates.push({
      source_id: p.source_id,
      catalog_name: p.name,
      sku,
      cod_articulo: hit.cod_articulo,
      barcode: hit.cod_barra,
      tango_desc: hit.descripcion,
      match_method: method,
      confidence,
    });
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const usedCodes = new Set<string>();
  const kept: Candidate[] = [];
  const droppedDup: Candidate[] = [];
  for (const c of candidates) {
    if (usedCodes.has(c.cod_articulo)) {
      droppedDup.push(c);
      continue;
    }
    usedCodes.add(c.cod_articulo);
    kept.push(c);
  }

  const { error: delErr } = await commercial.from("product_map").delete().neq("source_id", "__none__");
  if (delErr) throw new Error(delErr.message);

  if (kept.length) {
    const { error: insErr } = await commercial.from("product_map").insert(
      kept.map((c) => ({
        source_id: c.source_id,
        cod_articulo: c.cod_articulo,
        barcode: c.barcode,
        catalog_name: c.catalog_name,
        tango_desc: c.tango_desc,
        match_method: c.match_method,
        confidence: c.confidence,
        confirmed: false,
      })),
    );
    if (insErr) throw new Error(insErr.message);
  }

  const matched = kept.filter(
    (c) => c.match_method !== "nombre" || c.confidence >= NAME_OK,
  );
  const doubtful = kept.filter((c) => c.match_method === "nombre" && c.confidence < NAME_OK);
  const matchPct = catalog.length ? Math.round((matched.length / catalog.length) * 1000) / 10 : 0;

  const lines = [
    "# Product map — catálogo ↔ Tango",
    "",
    `- Catálogo publicados: **${catalog.length}**`,
    `- Artículos Tango: **${tango.length}**`,
    `- Matcheados (alta confianza): **${matched.length}** (${matchPct}% del catálogo)`,
    `- Dudosos (nombre ${NAME_WEAK}–${NAME_OK}, no auto-confirmados): **${doubtful.length}**`,
    `- Sin match: **${unmatched.length}**`,
    `- Descartados por \`cod_articulo\` ya asignado: **${droppedDup.length}**`,
    `- \`confirmed=false\` en todos (revisión admin pendiente)`,
    "",
    "## Matcheados",
    "",
    "| source_id | catálogo | tango | método | conf |",
    "|---|---|---|---|---|",
    ...matched.map(
      (c) =>
        `| ${c.source_id} | ${c.catalog_name.replace(/\|/g, "/")} | ${c.cod_articulo} | ${c.match_method} | ${c.confidence} |`,
    ),
    "",
    "## Dudosos",
    "",
    "| source_id | catálogo | tango | conf |",
    "|---|---|---|---|",
    ...doubtful.map(
      (c) =>
        `| ${c.source_id} | ${c.catalog_name.replace(/\|/g, "/")} | ${c.cod_articulo} | ${c.confidence} |`,
    ),
    "",
    "## Sin match",
    "",
    ...unmatched.slice(0, 200).map((p) => `- \`${p.source_id}\` — ${p.name}${p.sku ? ` (sku ${p.sku})` : ""}`),
    unmatched.length > 200 ? `\n… y ${unmatched.length - 200} más` : "",
    "",
  ];

  const reportsDir = path.join(ROOT, "reports");
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(path.join(reportsDir, "product-map.md"), lines.join("\n"), "utf8");
  console.log(
    JSON.stringify(
      {
        catalog: catalog.length,
        tango: tango.length,
        matched: matched.length,
        doubtful: doubtful.length,
        unmatched: unmatched.length,
        matchPct,
        report: "reports/product-map.md",
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
