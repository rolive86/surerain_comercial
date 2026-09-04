/**
 * Parse Lista Abril 2025 + ANEXO into tango.articulos_specs_raw.
 * Selling prices stay in effective_prices (Tango), not Excel.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import * as XLSX from "xlsx";
import { ROOT } from "../../src/config.js";
import type { Database, Json } from "../../src/types/commercial.types.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

const FILES = [
  "Lista_de_precios_Abril_2025.xlsx",
  "ANEXO_Lista_de_precios_2025.xlsx",
];

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function cell(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/\r\n/g, " ").replace(/\s+/g, " ").trim();
}

function asNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function looksLikeCode(value: string): boolean {
  if (value.length < 6) return false;
  return /[A-Za-z]/.test(value) && /[0-9]/.test(value);
}

function headerIndex(headers: string[], pred: (h: string) => boolean): number {
  return headers.findIndex((h) => pred(h.toLowerCase()));
}

function findHeaderRow(rows: unknown[][]): { row: number; headers: string[] } | null {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const headers = (rows[i] ?? []).map((c) => cell(c));
    const hasDesc = headers.some((h) => h.toLowerCase().includes("descrip"));
    const hasCode = headers.some((h) => /c[oó]digo/i.test(h));
    if (hasDesc && hasCode) return { row: i, headers };
  }
  return null;
}

type SpecRow = {
  cod_articulo: string;
  categoria: string;
  descripcion: string | null;
  precio_usd: number | null;
  specs: Record<string, string>;
  raw_payload: Record<string, unknown>;
  content_hash: string;
};

function parseSheet(sheetName: string, sheet: XLSX.WorkSheet): SpecRow[] {
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];
  const header = findHeaderRow(rows);
  if (!header) return [];

  const iDesc = headerIndex(header.headers, (h) => h.includes("descrip"));
  const iCode = headerIndex(header.headers, (h) => /c[oó]digo/.test(h));
  const iPrice = headerIndex(header.headers, (h) => h.includes("precio"));
  if (iCode < 0) return [];

  const out: SpecRow[] = [];
  let lastDesc = "";
  for (let r = header.row + 1; r < rows.length; r++) {
    const raw = rows[r] ?? [];
    const codigo = cell(raw[iCode]);
    const descCell = iDesc >= 0 ? cell(raw[iDesc]) : "";
    if (descCell) lastDesc = descCell;
    if (!codigo || !looksLikeCode(codigo)) continue;

    const specs: Record<string, string> = {};
    const payload: Record<string, unknown> = { sheet: sheetName, row: r };
    for (let c = 0; c < header.headers.length; c++) {
      const key = header.headers[c];
      if (!key) continue;
      const v = raw[c];
      payload[key] = v;
      if (c === iDesc || c === iCode || c === iPrice) continue;
      const s = cell(v);
      if (s) specs[key] = s;
    }

    const descripcion = lastDesc || null;
    const precio_usd = iPrice >= 0 ? asNum(raw[iPrice]) : null;
    const content_hash = createHash("md5")
      .update(JSON.stringify({ codigo, descripcion, specs, precio_usd, sheetName }))
      .digest("hex");
    out.push({
      cod_articulo: codigo,
      categoria: sheetName,
      descripcion,
      precio_usd,
      specs,
      raw_payload: payload,
      content_hash,
    });
  }
  return out;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_COMMERCIAL_SUPABASE_URL");
  const service = requireEnv("COMMERCIAL_SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient<Database>(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const byCode = new Map<string, SpecRow>();
  const byCategory = new Map<string, number>();
  const tangoDir = path.join(ROOT, "data", "tango");

  for (const file of FILES) {
    const filePath = path.join(tangoDir, file);
    if (!existsSync(filePath)) {
      console.log(`[skip] missing ${file}`);
      continue;
    }
    const wb = XLSX.read(readFileSync(filePath));
    for (const name of wb.SheetNames) {
      const parsed = parseSheet(name, wb.Sheets[name]);
      byCategory.set(name, (byCategory.get(name) ?? 0) + parsed.length);
      for (const row of parsed) byCode.set(row.cod_articulo, row);
    }
  }

  const rows = [...byCode.values()];
  const chunks: SpecRow[][] = [];
  for (let i = 0; i < rows.length; i += 200) chunks.push(rows.slice(i, i + 200));

  let upserted = 0;
  for (const part of chunks) {
    const { data, error } = await supabase.rpc("tango_specs_upsert", {
      p_rows: part as unknown as Json,
    });
    if (error) throw new Error(error.message);
    upserted += Number((data as { upserted?: number } | null)?.upserted ?? 0);
  }

  const { data: maps } = await supabase.from("product_map").select("cod_articulo");
  const mapped = new Set((maps ?? []).map((m) => m.cod_articulo));
  let excelInMap = 0;
  for (const code of byCode.keys()) if (mapped.has(code)) excelInMap += 1;

  console.log(
    JSON.stringify(
      {
        uniqueCodigos: rows.length,
        upserted,
        byCategory: Object.fromEntries(byCategory),
        excelCodigosEnProductMap: excelInMap,
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
