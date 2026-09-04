/**
 * Load Tango Cloud JSON samples into schema tango (staging).
 * Uses commercial SERVICE ROLE via public RPCs — tango is not an exposed PostgREST schema.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { ROOT } from "../../src/config.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

const TANGO_DIR = path.join(ROOT, "data", "tango");

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

function asBool(value: unknown): boolean | null {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return null;
}

function asNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function asTs(value: unknown): string | null {
  const s = asText(value);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function contentHash(record: unknown): string {
  return createHash("md5").update(JSON.stringify(record)).digest("hex");
}

function readArray(filePath: string): unknown[] {
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    for (const key of ["value", "data", "records", "Items"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  throw new Error(`JSON is not an array: ${filePath}`);
}

type Job = {
  file: string;
  entity: string;
  map: (row: Record<string, unknown>) => Record<string, unknown> | null;
};

const JOBS: Job[] = [
  {
    file: "01-articulos.json",
    entity: "articulos",
    map: (r) => {
      const cod = asText(r.cod_sta11 ?? r.cod_articulo ?? r.COD_ARTICULO);
      if (!cod) return null;
      return {
        cod_articulo: cod,
        id_sta11: asText(r.id_sta11),
        cod_barra: asText(r.cod_barra ?? r.codigo_de_barras),
        descripcion: asText(r.descripcio ?? r.descripcion),
        familia: asText(r.familia),
        iva_desc: asText(r.gva41_desc_iva),
        raw_payload: r,
        content_hash: contentHash(r),
        sync_status: "ok",
      };
    },
  },
  {
    file: "02-clientes.json",
    entity: "clientes",
    map: (r) => {
      const id = asText(r.id_gva14);
      if (!id) return null;
      return {
        id_gva14: id,
        cod_gva14: asText(r.cod_gva14 ?? r.cod_cliente ?? r.COD_CLIENTE_ENCAB),
        razon_social: asText(r.razon_soci ?? r.razon_social),
        cuit: asText(r.cuit),
        email: asText(r.e_mail ?? r.email),
        cod_vendedor: asText(r.gva23_codigo ?? r.cod_vendedor),
        nro_lista: asText(r.gva10_nro_de_lis),
        porc_desc: asNum(r.porc_desc),
        habilitado: asBool(r.habilitado),
        raw_payload: r,
        content_hash: contentHash(r),
        sync_status: "ok",
      };
    },
  },
  {
    file: "03_vendedores.json",
    entity: "vendedores",
    map: (r) => {
      const id = asText(r.id_gva23);
      if (!id) return null;
      return {
        id_gva23: id,
        cod_gva23: asText(r.cod_gva23 ?? r.cod_vendedor),
        nombre: asText(r.nombre_ven ?? r.nombre),
        inhabilitado: asBool(r.inhabilita ?? r.inhabilitado),
        raw_payload: r,
        content_hash: contentHash(r),
        sync_status: "ok",
      };
    },
  },
  {
    file: "04_listas_precios.json",
    entity: "listas_precios",
    map: (r) => {
      const id = asText(r.id_gva10);
      if (!id) return null;
      return {
        id_gva10: id,
        nro_de_lis: asText(r.nro_de_lis),
        nombre: asText(r.nombre_lis ?? r.nombre),
        habilitada: asBool(r.habilitada),
        mon_cte: asBool(r.mon_cte),
        raw_payload: r,
        content_hash: contentHash(r),
        sync_status: "ok",
      };
    },
  },
  {
    file: "05_precios_lista29_RAW.json",
    entity: "precios",
    map: (r) => {
      const lista = asText(r.COD_LISTA_DE_PRECIOS ?? r.cod_lista);
      const art = asText(r.COD_ARTICULO ?? r.cod_articulo);
      if (!lista || !art) return null;
      return {
        cod_lista: lista,
        cod_articulo: art,
        precio: asNum(r.PRECIO ?? r.precio),
        moneda: asBool(r.MONEDA ?? r.moneda),
        incluye_iva: asBool(r.INCLUYE_IVA ?? r.incluye_iva),
        fecha_ult_mod: asTs(r.FECHA_DE_ULTIMA_MODIFICACION ?? r.fecha_ult_mod),
        raw_payload: r,
        content_hash: contentHash(r),
        sync_status: "ok",
      };
    },
  },
  {
    file: "06_stock.json",
    entity: "stock",
    map: (r) => {
      const art = asText(r.cod_articulo);
      const dep = asText(r.cod_deposito);
      if (!art || !dep) return null;
      return {
        cod_articulo: art,
        cod_deposito: dep,
        deposito_desc: asText(r.descripcion_deposito),
        saldo: asNum(r.saldo_stock ?? r.saldo),
        comprometida: asNum(r.cantidad_comprometida),
        a_recibir: asNum(r.cantidad_a_recibir),
        raw_payload: r,
        content_hash: contentHash(r),
        sync_status: "ok",
      };
    },
  },
  {
    file: "07_ventas_detalle.json",
    entity: "ventas_detalle",
    map: (r) => ({
      content_hash: contentHash(r),
      nro_comprobante: asText(r.nro_comprobante),
      tipo_comprobante: asText(r.tipo_comprobante),
      fecha_emision: asTs(r.fecha_de_emision ?? r.fecha_emision),
      cod_cliente: asText(r.cod_cliente),
      cod_vendedor: asText(r.cod_vendedor),
      cod_articulo: asText(r.cod_articulo),
      cantidad: asNum(r.cantidad),
      precio_unitario: asNum(r.precio_unitario),
      total: asNum(r.total),
      moneda: asText(r.moneda),
      cotizacion: asNum(r.cotizacion),
      raw_payload: r,
    }),
  },
  {
    file: "10_tesoreria_RAW.json",
    entity: "tesoreria",
    map: (r) => ({
      content_hash: contentHash(r),
      id_sba04: asText(r.ID_SBA04 ?? r.id_sba04),
      fecha: asTs(r.FECHA ?? r.fecha),
      cod_cliente: asText(r.COD_CLIENTE_ENCAB ?? r.cod_cliente),
      comprobante: asText(r.COMPROBANTE ?? r.comprobante),
      total_cte: asNum(r.TOTAL_COMP_CTE ?? r.total_cte),
      moneda: asText(r.DESC_MONEDA ?? r.moneda),
      cotizacion: asNum(r.COTIZACION ?? r.cotizacion),
      raw_payload: r,
    }),
  },
];

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_COMMERCIAL_SUPABASE_URL");
  const service = requireEnv("COMMERCIAL_SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`tango:load from ${TANGO_DIR}`);

  for (const job of JOBS) {
    const filePath = path.join(TANGO_DIR, job.file);
    if (!existsSync(filePath)) {
      console.log(`[skip] missing ${job.file}`);
      continue;
    }

    const { data: runId, error: startErr } = await supabase.rpc("tango_staging_run_start", {
      p_entity: job.entity,
      p_source: "json_load",
      p_meta: { file: job.file },
    });
    if (startErr) throw new Error(`run_start ${job.entity}: ${startErr.message}`);

    let read = 0;
    let upserted = 0;
    let failed = 0;
    let errMsg: string | null = null;

    try {
      const raw = readArray(filePath);
      read = raw.length;
      const mapped: Record<string, unknown>[] = [];
      for (const item of raw) {
        if (!item || typeof item !== "object") {
          failed += 1;
          continue;
        }
        const row = job.map(item as Record<string, unknown>);
        if (!row) {
          failed += 1;
          continue;
        }
        mapped.push(row);
      }

      for (const part of chunk(mapped, 200)) {
        const { data, error } = await supabase.rpc("tango_staging_upsert", {
          p_entity: job.entity,
          p_rows: part,
        });
        if (error) throw error;
        const n = Number((data as { upserted?: number } | null)?.upserted ?? 0);
        upserted += n;
      }

      await supabase.rpc("tango_staging_run_finish", {
        p_id: runId,
        p_status: "ok",
        p_read: read,
        p_upserted: upserted,
        p_failed: failed,
        p_error: null,
      });
      console.log(`[ok] ${job.file} → ${job.entity} read=${read} upserted=${upserted} failed=${failed}`);
    } catch (err) {
      errMsg = err instanceof Error ? err.message : String(err);
      await supabase.rpc("tango_staging_run_finish", {
        p_id: runId,
        p_status: "error",
        p_read: read,
        p_upserted: upserted,
        p_failed: failed,
        p_error: errMsg,
      });
      console.error(`[error] ${job.file}: ${errMsg}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
