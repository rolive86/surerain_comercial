/**
 * Map catalog source_id → espejo_src.articulos (empresa 3) into public.product_map.
 * Primary match: barcode. Fallback: name. Does not overwrite confirmed/manual.
 * Requires COMMERCIAL_DATABASE_URL for FDW read. Writes reports/product-map.md.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { ROOT } from "../../src/config.js";
import { commercialSql, requireEnv } from "../espejo/db.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

const EMPRESA = "3";
const NAME_OK = 0.75;
const NAME_WEAK = 0.55;

function asText(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

/** Identity codes from espejo: exact, no trim. */
function asCode(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value);
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

function modelNeedle(name: string, sku: string | null): string | null {
  if (sku?.trim()) return normalizeName(sku);
  const m = name.match(/\b([a-z]{2,6})[\s-]*(\d{2,5})\b/i);
  if (!m) return null;
  return normalizeName(`${m[1]} ${m[2]}`);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / new Set([...a, ...b]).size;
}

/** Lookup key for barcodes only (does not alter stored codes). */
function barcodeKey(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
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
  requireEnv("COMMERCIAL_DATABASE_URL");

  const commercial = createClient(commercialUrl, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const catalog = await fetchAllCatalog(catalogUrl, catalogKey);

  const sql = commercialSql();
  let tango: TangoArt[] = [];
  try {
    const arts = await sql<
      Array<{ cod_sta11: string | null; cod_barra: string | null; descripcio: string | null }>
    >`
      select distinct on (cod_sta11)
        cod_sta11, cod_barra, descripcio
      from espejo_src.articulos
      where empresa = ${EMPRESA}
        and cod_sta11 is not null
        and cod_sta11 <> ''
      order by cod_sta11
    `;
    tango = arts
      .map((r) => {
        const cod = asCode(r.cod_sta11);
        if (!cod) return null;
        return {
          cod_articulo: cod,
          cod_barra: asCode(r.cod_barra),
          descripcion: asText(r.descripcio),
        };
      })
      .filter((x): x is TangoArt => x != null);
  } finally {
    await sql.end({ timeout: 5 });
  }

  const byBarcode = new Map<string, TangoArt>();
  const byCode = new Map<string, TangoArt>();
  for (const a of tango) {
    byCode.set(a.cod_articulo.toLowerCase(), a);
    if (a.cod_barra) byBarcode.set(barcodeKey(a.cod_barra), a);
  }

  const { data: existingMaps, error: existErr } = await commercial
    .from("product_map")
    .select("source_id, cod_articulo, confirmed, match_method");
  if (existErr) throw new Error(existErr.message);
  const protectedMaps = (existingMaps ?? []).filter(
    (m) => m.confirmed || m.match_method === "manual",
  );
  const protectedSources = new Set(protectedMaps.map((m) => m.source_id));
  const usedCodes = new Set(protectedMaps.map((m) => m.cod_articulo));

  const candidates: Candidate[] = [];
  const unmatched: CatalogProduct[] = [];

  for (const p of catalog) {
    if (protectedSources.has(p.source_id)) continue;
    const sku = p.sku?.trim() || null;
    const skuKey = sku ? barcodeKey(sku) : null;
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
      const model = modelNeedle(p.name, sku);
      const pool = model
        ? tango.filter((a) => normalizeName(a.descripcion ?? "").includes(model))
        : tango;
      let best = 0;
      let second = 0;
      let bestArt: TangoArt | null = null;
      const search = pool.length ? pool : tango;
      for (const a of search) {
        const score = jaccard(pt, tokens(a.descripcion ?? ""));
        if (score > best) {
          second = best;
          best = score;
          bestArt = a;
        } else if (score > second) {
          second = score;
        }
      }
      const uniquePool = Boolean(model) && pool.length === 1;
      const uniqueLead = Boolean(model) && bestArt && best > 0 && best - second >= 0.08;
      if (bestArt && (best >= NAME_WEAK || uniquePool || uniqueLead)) {
        hit = bestArt;
        method = "nombre";
        confidence = uniquePool && best < NAME_WEAK ? 0.82 : Math.round(best * 1000) / 1000;
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

  const { error: delErr } = await commercial.from("product_map").delete().eq("confirmed", false);
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
  const autoPlusProtected = matched.length + protectedMaps.length;
  const matchPct = catalog.length
    ? Math.round((autoPlusProtected / catalog.length) * 1000) / 10
    : 0;

  const byMethod = {
    barcode: kept.filter((c) => c.match_method === "barcode").length,
    sku: kept.filter((c) => c.match_method === "sku").length,
    nombre: kept.filter((c) => c.match_method === "nombre").length,
  };

  const lines = [
    "# Product map — catálogo ↔ Espejo Tango (empresa 3)",
    "",
    `- Fuente: \`espejo_src.articulos\` where empresa='3'`,
    `- Catálogo publicados: **${catalog.length}**`,
    `- Artículos Tango (emp 3): **${tango.length}**`,
    `- Con barcode: **${tango.filter((a) => a.cod_barra).length}**`,
    `- Protegidos (confirmados / manuales, no se pisan): **${protectedMaps.length}**`,
    `- Matcheados auto (alta confianza): **${matched.length}**`,
    `- Cobertura auto+protegidos: **${autoPlusProtected}/${catalog.length}** (${matchPct}%)`,
    `- Dudosos (nombre ${NAME_WEAK}–${NAME_OK}): **${doubtful.length}**`,
    `- Sin match: **${unmatched.length}**`,
    `- Descartados por \`cod_articulo\` ya asignado: **${droppedDup.length}**`,
    `- Métodos auto: barcode=${byMethod.barcode}, sku=${byMethod.sku}, nombre=${byMethod.nombre}`,
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
    ...unmatched
      .slice(0, 200)
      .map((p) => `- \`${p.source_id}\` — ${p.name}${p.sku ? ` (sku ${p.sku})` : ""}`),
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
        tangoWithBarcode: tango.filter((a) => a.cod_barra).length,
        protected: protectedMaps.length,
        matched: matched.length,
        coverage: `${autoPlusProtected}/${catalog.length}`,
        matchPct,
        doubtful: doubtful.length,
        unmatched: unmatched.length,
        byMethod,
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
