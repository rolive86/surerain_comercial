/**
 * Copy espejo_src.ventas (empresa 3 + 5) → public.sales_history.
 * Chunked by year of fecha_de_emision. Append-only on content_hash.
 * Hash = md5(empresa || '|' || md5(nro|art|renglon)).
 * Customer resolve only for empresa 3. Requires COMMERCIAL_DATABASE_URL.
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { ROOT } from "../../src/config.js";
import { commercialSql, requireEnv } from "./db.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

const EMPRESAS = ["3", "5"] as const;
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
        ${sql.json({ empresa: EMPRESAS, chunk: "year" })}
      ) as id
    `;
    runId = started[0]?.id ?? null;
    log(`sync_run ${runId}`);

    for (const empresa of EMPRESAS) {
      for (const year of YEARS) {
        const from = `${year}-01-01`;
        const to = `${year + 1}-01-01`;
        log(`chunk empresa=${empresa} year=${year}…`);

        const before = await sql<{ n: string }[]>`
          select count(*)::text as n from public.sales_history
          where empresa = ${empresa}
        `;
        const beforeN = Number(before[0]?.n ?? 0);

        const result = await sql`
          insert into public.sales_history as t (
            content_hash,
            empresa,
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
              coalesce(v.empresa, '') || '|' ||
              md5(
                coalesce(v.nro_comprobante, '') || '|' ||
                coalesce(v.cod_articulo, '') || '|' ||
                coalesce(v.id_sta22_renglon, '')
              )
            ),
            v.empresa,
            v.nro_comprobante,
            v.tipo_comprobante,
            nullif(btrim(v.fecha_de_emision), '')::date,
            v.cod_cliente,
            case when v.empresa = '3' then cu.id else null end,
            v.cod_vendedor,
            v.cod_articulo,
            nullif(btrim(v.cantidad), '')::numeric,
            nullif(btrim(v.precio_unitario), '')::numeric,
            nullif(btrim(v.total), '')::numeric,
            nullif(btrim(v.moneda), '')
          from espejo_src.ventas v
          left join public.customers cu
            on cu.tango_customer_id = v.cod_cliente
            and v.empresa = '3'
          where v.empresa = ${empresa}
            and v.fecha_de_emision >= ${from}
            and v.fecha_de_emision < ${to}
            and v.cod_articulo is not null
            and v.cod_articulo <> ''
          on conflict (content_hash) do nothing
        `;

        const after = await sql<{ n: string }[]>`
          select count(*)::text as n from public.sales_history
          where empresa = ${empresa}
        `;
        const afterN = Number(after[0]?.n ?? 0);
        const inserted = afterN - beforeN;
        totalUpserted += inserted;
        totalRead += inserted;
        log(`   emp ${empresa} ${year}: +${inserted} (emp total ${afterN})`, {
          count: result.count,
        });
      }
    }

    const stats = await sql<{
      empresa: string;
      rows: string;
      total: string;
    }[]>`
      select
        empresa,
        count(*)::text as rows,
        round(sum(total_facturado))::text as total
      from public.sales_history
      group by empresa
      order by empresa
    `;
    log("GATE2", stats);

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
