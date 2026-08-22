/**
 * Normalize espejo_src (empresa='3') → public masters + lista 29 prices.
 * Codes NOT trimmed (identity). Display names trimmed. Numerics cast in SQL.
 * Set-based (no per-row loops). Requires COMMERCIAL_DATABASE_URL.
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { ROOT } from "../../src/config.js";
import { commercialSql, requireEnv } from "./db.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

const EMPRESA = "3";
const LIST_CODE = "29";
const PRICE_VALID_FROM = "2025-04-01T00:00:00.000Z";

function log(msg: string, extra?: unknown) {
  if (extra !== undefined) console.log(msg, extra);
  else console.log(msg);
}

async function main() {
  requireEnv("COMMERCIAL_DATABASE_URL");
  const sql = commercialSql();

  try {
    log("1/6 vendedores…");
    const vend = await sql`
      insert into public.sales_reps as t (
        tango_sales_rep_id, external_id, name, active,
        source_system, last_synced_at, sync_status
      )
      select distinct on (v.cod_gva23)
        v.cod_gva23,
        nullif(v.id_gva23, ''),
        nullif(btrim(v.nombre_ven), ''),
        (coalesce(lower(btrim(v.inhabilita)), 'false') is distinct from 'true'),
        'tango',
        now(),
        'ok'
      from espejo_src.vendedores v
      where v.empresa = ${EMPRESA}
        and v.cod_gva23 is not null
        and v.cod_gva23 <> ''
        and nullif(btrim(v.nombre_ven), '') is not null
      order by v.cod_gva23
      on conflict (tango_sales_rep_id) do update set
        external_id = excluded.external_id,
        name = excluded.name,
        active = excluded.active,
        source_system = excluded.source_system,
        last_synced_at = excluded.last_synced_at,
        sync_status = excluded.sync_status
      returning id
    `;
    log(`   upserted ${vend.count} sales_reps`);

    log("2/6 clientes…");
    const cust = await sql`
      insert into public.customers as t (
        tango_customer_id, external_id, legal_name, cuit, email, tax_condition,
        active, source_system, last_synced_at, sync_status
      )
      select distinct on (c.cod_gva14)
        c.cod_gva14,
        nullif(c.id_gva14, ''),
        nullif(btrim(c.razon_soci), ''),
        nullif(c.cuit, ''),
        nullif(btrim(c.e_mail), ''),
        nullif(btrim(c.desc_categoria_iva), ''),
        coalesce(lower(btrim(c.habilitado)), 'true') in ('true', '1'),
        'tango',
        now(),
        'ok'
      from espejo_src.clientes c
      where c.empresa = ${EMPRESA}
        and c.cod_gva14 is not null
        and c.cod_gva14 <> ''
        and nullif(btrim(c.razon_soci), '') is not null
      order by c.cod_gva14
      on conflict (tango_customer_id) do update set
        external_id = excluded.external_id,
        legal_name = excluded.legal_name,
        cuit = excluded.cuit,
        email = excluded.email,
        tax_condition = excluded.tax_condition,
        active = excluded.active,
        source_system = excluded.source_system,
        last_synced_at = excluded.last_synced_at,
        sync_status = excluded.sync_status
      returning id
    `;
    log(`   upserted ${cust.count} customers`);

    log("3/6 asignaciones (cerrar cambios + abrir vigentes)…");
    // Close every active assignment that is not the intended vendor (also cleans prior dups)
    const closed = await sql`
      with intended as (
        select distinct on (e.cod_gva14)
          cu.id as customer_id,
          sr.id as sales_rep_id
        from espejo_src.clientes e
        join public.customers cu
          on cu.tango_customer_id = e.cod_gva14
        join public.sales_reps sr
          on sr.tango_sales_rep_id = e.gva23_codigo
        where e.empresa = ${EMPRESA}
          and e.cod_gva14 is not null and e.cod_gva14 <> ''
          and e.gva23_codigo is not null and e.gva23_codigo <> ''
        order by e.cod_gva14
      )
      update public.customer_sales_rep csr
      set active = false, valid_to = now()
      from intended i
      where csr.customer_id = i.customer_id
        and csr.active = true
        and csr.valid_to is null
        and csr.sales_rep_id is distinct from i.sales_rep_id
      returning csr.id
    `;
    log(`   closed ${closed.count} non-intended assignments`);

    // If multiple active rows already point to the intended rep, keep the oldest
    const dedup = await sql`
      with ranked as (
        select id,
               row_number() over (
                 partition by customer_id
                 order by created_at asc, id asc
               ) as rn
        from public.customer_sales_rep
        where active and valid_to is null
      )
      update public.customer_sales_rep csr
      set active = false, valid_to = now()
      from ranked r
      where csr.id = r.id and r.rn > 1
      returning csr.id
    `;
    log(`   closed ${dedup.count} duplicate active assignments (any)`);

    // Open missing / new assignments (unique index enforces one active per customer)
    const opened = await sql`
      with intended as (
        select distinct on (e.cod_gva14)
          cu.id as customer_id,
          sr.id as sales_rep_id
        from espejo_src.clientes e
        join public.customers cu
          on cu.tango_customer_id = e.cod_gva14
        join public.sales_reps sr
          on sr.tango_sales_rep_id = e.gva23_codigo
        where e.empresa = ${EMPRESA}
          and e.cod_gva14 is not null and e.cod_gva14 <> ''
          and e.gva23_codigo is not null and e.gva23_codigo <> ''
        order by e.cod_gva14
      )
      insert into public.customer_sales_rep (
        customer_id, sales_rep_id, active, valid_from, valid_to, source_system
      )
      select i.customer_id, i.sales_rep_id, true, now(), null, 'tango'
      from intended i
      where not exists (
        select 1
        from public.customer_sales_rep csr
        where csr.customer_id = i.customer_id
          and csr.active = true
          and csr.valid_to is null
      )
      returning id
    `;
    log(`   opened ${opened.count} assignments`);

    // Mark existing matching links as tango source
    await sql`
      with intended as (
        select distinct on (e.cod_gva14)
          cu.id as customer_id, sr.id as sales_rep_id
        from espejo_src.clientes e
        join public.customers cu on cu.tango_customer_id = e.cod_gva14
        join public.sales_reps sr on sr.tango_sales_rep_id = e.gva23_codigo
        where e.empresa = ${EMPRESA}
          and e.gva23_codigo is not null and e.gva23_codigo <> ''
        order by e.cod_gva14
      )
      update public.customer_sales_rep csr
      set source_system = 'tango'
      from intended i
      where csr.customer_id = i.customer_id
        and csr.sales_rep_id = i.sales_rep_id
        and csr.active = true
        and csr.valid_to is null
        and csr.source_system is distinct from 'tango'
    `;

    log("4/6 lista 29…");
    const lista = await sql`
      insert into public.price_lists (
        code, name, currency, active, tango_price_list_id,
        source_system, last_synced_at, sync_status
      )
      select
        ${LIST_CODE},
        coalesce(nullif(btrim(l.nombre_lis), ''), 'ABRIL 2025'),
        case
          when coalesce(lower(btrim(l.mon_cte)), 'true') in ('false', '0') then 'USD'
          else 'ARS'
        end,
        coalesce(lower(btrim(l.habilitada)), 'true') in ('true', '1'),
        nullif(l.id_gva10, ''),
        'tango',
        now(),
        'ok'
      from espejo_src.listas_precios l
      where l.empresa = ${EMPRESA}
        and l.nro_de_lis = ${LIST_CODE}
      limit 1
      on conflict (code) do update set
        name = excluded.name,
        currency = excluded.currency,
        active = excluded.active,
        tango_price_list_id = excluded.tango_price_list_id,
        source_system = excluded.source_system,
        last_synced_at = excluded.last_synced_at,
        sync_status = excluded.sync_status
      returning id, code, name, currency
    `;
    if (!lista.length) throw new Error("lista 29 missing in espejo_src empresa 3");
    log("   lista", lista[0]);

    log("5/6 precios lista 29…");
    const precios = await sql`
      insert into public.prices (
        price_list_id, product_source_id, amount, tango_id,
        valid_from, last_synced_at, sync_status
      )
      select
        pl.id,
        p.cod_sta11,
        replace(btrim(p.precio), ',', '.')::numeric,
        coalesce(nullif(p.id_gva17, ''), ${LIST_CODE} || ':' || p.cod_sta11),
        ${PRICE_VALID_FROM}::timestamptz,
        now(),
        'ok'
      from espejo_src.precios_por_articulo p
      cross join lateral (
        select id from public.price_lists where code = ${LIST_CODE} limit 1
      ) pl
      where p.empresa = ${EMPRESA}
        and p.nro_de_lis = ${LIST_CODE}
        and p.cod_sta11 is not null
        and p.cod_sta11 <> ''
        and nullif(btrim(p.precio), '') is not null
      on conflict (price_list_id, product_source_id, valid_from) do update set
        amount = excluded.amount,
        tango_id = excluded.tango_id,
        last_synced_at = excluded.last_synced_at,
        sync_status = excluded.sync_status
      returning id
    `;
    log(`   upserted ${precios.count} prices`);

    log("6/6 recompute_effective_prices…");
    await sql`select public.recompute_effective_prices()`;

    const counts = await sql`
      select
        (select count(*)::int from public.sales_reps) as sales_reps,
        (select count(*)::int from public.sales_reps where tango_sales_rep_id is not null) as sales_reps_tango,
        (select count(*)::int from public.customers) as customers,
        (select count(*)::int from public.customers where tango_customer_id is not null) as customers_tango,
        (select count(*)::int from public.customers where tango_customer_id is null) as customers_demo,
        (select count(*)::int from public.customer_sales_rep where active and valid_to is null) as assignments_active,
        (select count(*)::int from public.prices p
           join public.price_lists pl on pl.id = p.price_list_id
          where pl.code = ${LIST_CODE}) as prices_lista_29,
        (select count(*)::int from public.effective_prices where customer_id is null) as effective_default
    `;

    console.log(JSON.stringify({ ok: true, counts: counts[0] }, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
