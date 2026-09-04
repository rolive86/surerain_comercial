/**
 * Refresh public.products_tango from espejo_src (empresa 3).
 * Universe = precio lista 29 OR stock > 0. Enrich images via product_map + ecommerce.
 */
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { ROOT } from "../../src/config.js";
import { commercialSql, requireEnv } from "./db.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

const EMPRESA = "3";
const LIST_CODE = "29";

function publicStorageUrl(
  bucket: string | null | undefined,
  storagePath: string | null | undefined,
): string | null {
  if (!bucket || !storagePath) return null;
  const base = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const pathPart = storagePath.replace(/^\//, "");
  return `${base}/storage/v1/object/public/${bucket}/${pathPart}`;
}

function log(msg: string, extra?: unknown) {
  if (extra !== undefined) console.log(msg, extra);
  else console.log(msg);
}

async function fetchImageBySourceId(
  sourceIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!sourceIds.length) return out;
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const pageSize = 200;
  for (let i = 0; i < sourceIds.length; i += pageSize) {
    const chunk = sourceIds.slice(i, i + pageSize);
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        source_id,
        featured_image:media!products_featured_image_id_fkey (
          bucket, storage_path
        )
      `,
      )
      .in("source_id", chunk);
    if (error) throw new Error(`catalog images: ${error.message}`);
    for (const row of data ?? []) {
      const featured = Array.isArray(row.featured_image)
        ? row.featured_image[0]
        : row.featured_image;
      const media = featured as { bucket: string | null; storage_path: string | null } | null;
      const imageUrl = publicStorageUrl(media?.bucket, media?.storage_path);
      if (imageUrl && row.source_id) out.set(String(row.source_id), imageUrl);
    }
  }
  return out;
}

async function main() {
  requireEnv("COMMERCIAL_DATABASE_URL");
  const sql = commercialSql();

  let runId: string | null = null;
  try {
    const started = await sql<{ id: string }[]>`
      select public.tango_staging_run_start(
        'products_tango',
        'espejo_refresh',
        ${sql.json({ empresa: EMPRESA, list: LIST_CODE })}::jsonb
      ) as id
    `;
    runId = started[0]?.id ?? null;
    log("refresh products_tango…");

    // Universe + attrs + stock + price flag in one set-based upsert
    const upserted = await sql`
      with priced as (
        select distinct p.product_source_id as cod
        from public.prices p
        join public.price_lists pl on pl.id = p.price_list_id
        where pl.code = ${LIST_CODE}
          and p.product_source_id is not null
          and p.product_source_id <> ''
      ),
      stocked as (
        select
          s.cod_articulo as cod,
          sum(replace(btrim(s.saldo_stock), ',', '.')::numeric) as qty
        from espejo_src.stock s
        where s.empresa = ${EMPRESA}
          and s.cod_articulo is not null
          and s.cod_articulo <> ''
          and nullif(btrim(s.saldo_stock), '') is not null
        group by s.cod_articulo
        having sum(replace(btrim(s.saldo_stock), ',', '.')::numeric) > 0
      ),
      universe as (
        select cod from priced
        union
        select cod from stocked
      ),
      arts_base as (
        select distinct on (a.cod_sta11)
          a.cod_sta11,
          nullif(btrim(a.descripcio), '') as descripcion,
          nullif(btrim(a.familia), '') as familia_raw,
          nullif(a.cod_barra, '') as cod_barra,
          nullif(btrim(a.medida_stock_sigla), '') as unidad
        from espejo_src.articulos a
        where a.empresa = ${EMPRESA}
          and a.cod_sta11 is not null
          and a.cod_sta11 <> ''
        order by a.cod_sta11
      ),
      -- articulos.familia suele venir vacío en el espejo; fallback =
      -- agrupaciones_articulos por prefijo (cod_sta29). Preferir líneas
      -- (código sin espacios leading) vs marcas.
      agr as (
        select
          btrim(cod_sta29) as cod,
          nullif(btrim(nom_agr), '') as nom,
          (cod_sta29 ~ '^\\s') as is_brandish
        from espejo_src.agrupaciones_articulos
        where empresa = ${EMPRESA}
          and nullif(btrim(nom_agr), '') is not null
          and nullif(btrim(cod_sta29), '') is not null
      ),
      arts_fam as (
        select distinct on (a.cod_sta11)
          a.cod_sta11,
          g.nom as familia_agr
        from arts_base a
        join agr g on left(a.cod_sta11, length(g.cod)) = g.cod
        order by a.cod_sta11, g.is_brandish asc, length(g.cod) desc
      ),
      arts as (
        select
          a.cod_sta11,
          a.descripcion,
          coalesce(a.familia_raw, f.familia_agr) as familia,
          a.cod_barra,
          a.unidad
        from arts_base a
        left join arts_fam f on f.cod_sta11 = a.cod_sta11
      ),
      mapped as (
        select distinct on (pm.cod_articulo)
          pm.cod_articulo,
          pm.source_id as catalog_source_id
        from public.product_map pm
        where pm.cod_articulo is not null and pm.cod_articulo <> ''
        order by pm.cod_articulo, pm.confirmed desc, pm.created_at asc
      ),
      rows as (
        select
          u.cod as cod_articulo,
          ar.descripcion,
          ar.familia,
          ar.cod_barra,
          ar.unidad,
          m.catalog_source_id,
          (u.cod in (select cod from priced)) as has_price,
          coalesce(st.qty, 0) > 0 as has_stock,
          st.qty as stock_qty
        from universe u
        left join arts ar on ar.cod_sta11 = u.cod
        left join stocked st on st.cod = u.cod
        left join mapped m on m.cod_articulo = u.cod
      )
      insert into public.products_tango as t (
        cod_articulo, descripcion, familia, cod_barra, unidad,
        catalog_source_id, has_price, has_stock, stock_qty,
        active, updated_at
      )
      select
        r.cod_articulo,
        r.descripcion,
        r.familia,
        r.cod_barra,
        r.unidad,
        r.catalog_source_id,
        r.has_price,
        r.has_stock,
        r.stock_qty,
        true,
        now()
      from rows r
      on conflict (cod_articulo) do update set
        descripcion = excluded.descripcion,
        familia = excluded.familia,
        cod_barra = excluded.cod_barra,
        unidad = excluded.unidad,
        catalog_source_id = excluded.catalog_source_id,
        has_price = excluded.has_price,
        has_stock = excluded.has_stock,
        stock_qty = excluded.stock_qty,
        active = true,
        updated_at = now()
      returning cod_articulo, catalog_source_id
    `;

    const returned = upserted as Array<{
      cod_articulo: string;
      catalog_source_id: string | null;
    }>;
    log(`   upserted ${returned.length} active rows`);

    const deactivated = await sql`
      update public.products_tango t
      set active = false, updated_at = now()
      where t.active = true
        and not exists (
          select 1
          from (
            select distinct p.product_source_id as cod
            from public.prices p
            join public.price_lists pl on pl.id = p.price_list_id
            where pl.code = ${LIST_CODE}
            union
            select s.cod_articulo
            from espejo_src.stock s
            where s.empresa = ${EMPRESA}
              and s.cod_articulo is not null and s.cod_articulo <> ''
              and nullif(btrim(s.saldo_stock), '') is not null
            group by s.cod_articulo
            having sum(replace(btrim(s.saldo_stock), ',', '.')::numeric) > 0
          ) u
          where u.cod = t.cod_articulo
        )
      returning cod_articulo
    `;
    log(`   deactivated ${deactivated.count} out-of-universe`);

    const withMap = returned
      .map((r) => r.catalog_source_id)
      .filter((x): x is string => Boolean(x));
    const images = await fetchImageBySourceId([...new Set(withMap)]);
    log(`   images resolved ${images.size}/${withMap.length} mapped`);

    // Clear stale images then set current
    await sql`
      update public.products_tango
      set image_url = null
      where active = true and image_url is not null
        and (catalog_source_id is null or catalog_source_id = '')
    `;

    const imageRows = [...images.entries()].map(([catalog_source_id, image_url]) => ({
      catalog_source_id,
      image_url,
    }));
    if (imageRows.length) {
      await sql`
        update public.products_tango t
        set image_url = v.image_url, updated_at = now()
        from jsonb_to_recordset(${sql.json(imageRows)}::jsonb) as v(
          catalog_source_id text,
          image_url text
        )
        where t.catalog_source_id = v.catalog_source_id
          and t.active = true
      `;
    }

    const counts = await sql`
      select
        (select count(*)::int from public.products_tango where active) as active,
        (select count(*)::int from public.products_tango where active and image_url is not null) as with_image,
        (select count(*)::int from public.products_tango where active and has_price) as with_price,
        (select count(*)::int from public.products_tango where active and has_stock) as with_stock,
        (select count(*)::int from public.products_tango where active and has_stock and not has_price) as stock_no_price,
        (select count(*)::int from public.products_tango where active and has_price and not has_stock) as price_no_stock,
        (select count(distinct familia)::int from public.products_tango where active and familia is not null) as distinct_familia
    `;

    if (runId) {
      await sql`
        select public.tango_staging_run_finish(
          ${runId}::uuid,
          'ok',
          ${returned.length},
          ${returned.length},
          0,
          null
        )
      `;
    }

    console.log(JSON.stringify({ ok: true, counts: counts[0] }, null, 2));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (runId) {
      await sql`
        select public.tango_staging_run_finish(
          ${runId}::uuid, 'error', 0, 0, 1, ${msg}
        )
      `.catch(() => undefined);
    }
    throw err;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
