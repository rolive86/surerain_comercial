/**
 * Copy espejo_src.ventas (empresa 3) → public.sales_history.
 * Chunked by year of fecha_de_emision (FDW ~102k; no live aggregates).
 * Append-only upsert on content_hash. Requires COMMERCIAL_DATABASE_URL.
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { ROOT } from "../../src/config.js";
import { commercialSql, requireEnv } from "./db.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

const EMPRESA = "3";
/** Inclusive start years to try (ISO text compare on fecha_de_emision). */
const YEARS = [
  2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027,
];

function log(msg: string, extra?: unknown) {
  if (extra !== undefined) console.log(msg, extra);
  else console.log(msg);
}

async function main() {
  requireEnv("COMMERCIAL_DATABASE_URL");
  const sql = commercialSql();

  let runId: string | null = null;
  let totalRead = 0;
  let totalUpserted = 0;

  try {
    await sql`select set_config('statement_timeout', '180000', false)`;

    const started = await sql<{ id: string }[]>`
      select public.tango_staging_run_start(
        'sales_history',
        'espejo_refresh',
        ${sql.json({ empresa: EMPRESA, chunk: "year" })}
      ) as id
    `;
    runId = started[0]?.id ?? null;
    log(`sync_run ${runId}`);

    for (const year of YEARS) {
      const from = `${year}-01-01`;
      const to = `${year + 1}-01-01`;
      log(`chunk ${year}…`);

      const before = await sql<{ n: string }[]>`
        select count(*)::text as n from public.sales_history
      `;
      const beforeN = Number(before[0]?.n ?? 0);

      const result = await sql`
        insert into public.sales_history as t (
          content_hash,
          nro_comprobante,
          tipo_comprobante,
          fecha,
          cod_cliente,
          customer_id,
          cod_vendedor,
          cod_articulo,
          cantidad,
          precio_unitario_usd,
          total_facturado,
          moneda
        )
        select
          md5(
            coalesce(v.nro_comprobante, '') || '|' ||
            coalesce(v.cod_articulo, '') || '|' ||
            coalesce(v.id_sta22_renglon, '')
          ),
          v.nro_comprobante,
          v.tipo_comprobante,
          nullif(btrim(v.fecha_de_emision), '')::date,
          v.cod_cliente,
          cu.id,
          v.cod_vendedor,
          v.cod_articulo,
          nullif(btrim(v.cantidad), '')::numeric,
          nullif(btrim(v.precio_unitario), '')::numeric,
          nullif(btrim(v.total), '')::numeric,
          nullif(btrim(v.moneda), '')
        from espejo_src.ventas v
        left join public.customers cu
          on cu.tango_customer_id = v.cod_cliente
        where v.empresa = ${EMPRESA}
          and v.fecha_de_emision >= ${from}
          and v.fecha_de_emision < ${to}
          and v.cod_articulo is not null
          and v.cod_articulo <> ''
        on conflict (content_hash) do nothing
      `;

      const after = await sql<{ n: string }[]>`
        select count(*)::text as n from public.sales_history
      `;
      const afterN = Number(after[0]?.n ?? 0);
      const inserted = afterN - beforeN;
      totalUpserted += inserted;
      // count approximate read as inserted + conflicts unknown; use count from FDW chunk if cheap
      totalRead += inserted;
      log(`   ${year}: +${inserted} (table now ${afterN})`, {
        count: result.count,
      });
    }

    const stats = await sql<{
      rows: string;
      customers: string;
      unmatched: string;
    }[]>`
      select
        count(*)::text as rows,
        count(distinct customer_id)::text as customers,
        count(*) filter (where customer_id is null)::text as unmatched
      from public.sales_history
    `;
    log("GATE", stats[0]);

    if (runId) {
      await sql`
        select public.tango_staging_run_finish(
          ${runId}::uuid,
          'ok',
          ${totalRead},
          ${totalUpserted},
          0,
          null
        )
      `;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    if (runId) {
      await sql`
        select public.tango_staging_run_finish(
          ${runId}::uuid,
          'error',
          ${totalRead},
          ${totalUpserted},
          0,
          ${msg}
        )
      `;
    }
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();
