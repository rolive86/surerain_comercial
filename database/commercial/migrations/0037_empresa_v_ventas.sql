-- SURE RAIN COMMERCIAL DB — 0037 empresa dimension + capa semántica v_ventas
-- Additive. Empresa '3'=Sure Rain, '5'=Angus. Codes NOT trimmed.
-- content_hash includes empresa via md5(empresa || '|' || md5(nro|art|renglon)).

-- ── sales_history.empresa ────────────────────────────────────────────────────
alter table public.sales_history
  add column if not exists empresa text;

update public.sales_history
set empresa = '3'
where empresa is null;

alter table public.sales_history
  alter column empresa set default '3';

alter table public.sales_history
  alter column empresa set not null;

create index if not exists sh_empresa_idx on public.sales_history (empresa);
create index if not exists sh_empresa_fecha_idx on public.sales_history (empresa, fecha);
create index if not exists sh_empresa_vendedor_idx on public.sales_history (empresa, cod_vendedor);

-- Rewrite hashes once: old = md5(nro|art|renglon), new = md5(empresa || '|' || old).
-- Guard: skip if Angus rows already present (migration already applied).
do $$
begin
  if not exists (
    select 1 from public.sales_history where empresa = '5' limit 1
  ) then
    update public.sales_history
    set content_hash = md5(empresa || '|' || content_hash);
  end if;
end $$;

comment on column public.sales_history.empresa is
  'Tango empresa: 3=Sure Rain, 5=Angus. Part of content_hash identity.';

-- ── sales_exclusiones (conceptos / merchandising por código) ─────────────────
create table if not exists public.sales_exclusiones (
  cod_articulo text primary key,
  motivo       text,
  created_at   timestamptz not null default now()
);

alter table public.sales_exclusiones enable row level security;

drop policy if exists se_staff_select on public.sales_exclusiones;
create policy se_staff_select on public.sales_exclusiones
  for select using (public.current_role() in ('sales_manager','operations','admin'));

drop policy if exists se_staff_write on public.sales_exclusiones;
create policy se_staff_write on public.sales_exclusiones
  for all using (public.current_role() in ('sales_manager','admin'))
  with check (public.current_role() in ('sales_manager','admin'));

grant select on public.sales_exclusiones to authenticated;
grant all on public.sales_exclusiones to service_role;

insert into public.sales_exclusiones (cod_articulo, motivo) values
  ('CHEQUERECHAZADO', 'concepto'),
  ('GASTOSBANCARIOS', 'concepto'),
  ('GASTOS DE ENVIO', 'concepto'),
  ('FLETE', 'concepto'),
  ('MERCLAPICERASNU', 'merchandising (código MERC*; sin familia MERCHANDISING en emp 3)'),
  ('MERCEXHIBIDORES', 'merchandising (código MERC*)'),
  ('MERCREMAZULES', 'merchandising (código MERC*)'),
  ('MERCREMBLANCAS', 'merchandising (código MERC*)')
on conflict (cod_articulo) do nothing;

-- ── Labels módulo visibles ───────────────────────────────────────────────────
update public.app_modules
set label = replace(label, 'Gestión ·', 'Comercial ·')
where label like 'Gestión ·%';

-- ── v_sales_enriched (+ empresa, moneda, usd, vendedor; joins empresa-aware) ─
-- Append-only column changes via CREATE OR REPLACE (PG allows adding at end).
create or replace view public.v_sales_enriched
with (security_invoker = true) as
select
  sh.customer_id,
  sh.cod_cliente,
  c.legal_name as cliente,
  c.city as localidad,
  c.province as provincia,
  c.phone as telefono,
  sh.cod_vendedor,
  sh.cod_articulo,
  pt.descripcion,
  pt.familia,
  sh.fecha,
  extract(year from sh.fecha)::int as anio,
  extract(month from sh.fecha)::int as mes,
  sh.cantidad,
  sh.total_facturado,
  sh.tipo_comprobante,
  public.sales_line_signed_qty(sh.tipo_comprobante, sh.cantidad) as cantidad_signed,
  public.sales_line_signed_total(sh.tipo_comprobante, sh.total_facturado) as total_signed,
  sh.nro_comprobante,
  sh.empresa,
  sh.precio_unitario_usd,
  sh.moneda,
  sr.name as vendedor
from public.sales_history sh
left join public.customers c
  on c.id = sh.customer_id
left join public.products_tango pt
  on pt.cod_articulo = sh.cod_articulo
  and sh.empresa = '3'
left join public.sales_reps sr
  on sr.tango_sales_rep_id = sh.cod_vendedor
  and sh.empresa = '3';

grant select on public.v_sales_enriched to authenticated;

-- ── v_ventas: fuente de verdad única del dashboard comercial ─────────────────
-- NC netean (via total_signed / cantidad_signed). Excluye sales_exclusiones
-- y familia MERCHANDISING si existiera.
create or replace view public.v_ventas
with (security_invoker = true) as
select
  v.empresa,
  v.cod_vendedor,
  v.vendedor,
  v.customer_id,
  v.cod_cliente,
  v.cliente,
  v.localidad,
  v.provincia,
  v.cod_articulo,
  v.descripcion,
  v.familia,
  v.fecha,
  v.anio,
  v.mes,
  v.nro_comprobante,
  v.tipo_comprobante,
  v.moneda,
  v.cantidad,
  v.cantidad_signed,
  v.precio_unitario_usd,
  v.total_facturado,
  v.total_signed as venta_ars,
  public.sales_line_signed_total(
    v.tipo_comprobante,
    coalesce(v.precio_unitario_usd, 0) * coalesce(v.cantidad, 0)
  ) as venta_usd
from public.v_sales_enriched v
where not exists (
  select 1
  from public.sales_exclusiones x
  where x.cod_articulo = v.cod_articulo
)
and (
  v.familia is null
  or upper(btrim(v.familia)) is distinct from 'MERCHANDISING'
);

grant select on public.v_ventas to authenticated;

-- ── Sync ventas: empresas 3 y 5, hash con empresa, customer solo emp 3 ───────
create or replace function public.tango_sync_ventas_incremental()
returns jsonb
language plpgsql
security definer
set search_path = public, espejo_src, pg_temp
as $$
declare
  v_run_id    uuid;
  v_desde     date;
  v_hasta     date;
  v_chunk     date;
  v_after     bigint;
  v_inserted  bigint;
  v_chunk_ins bigint;
begin
  perform set_config('statement_timeout', '120000', true);

  v_desde := (
    select coalesce(max(fecha), date '2000-01-01')
    from public.sales_history
  ) - interval '3 days';
  v_hasta := current_date + 1;

  v_run_id := public.tango_staging_run_start(
    'sales_history',
    'cron',
    jsonb_build_object('empresa', array['3','5'], 'desde', v_desde, 'hasta', v_hasta)
  );

  v_inserted := 0;
  v_chunk := v_desde;
  while v_chunk < v_hasta loop
    insert into public.sales_history (
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
    where v.empresa in ('3', '5')
      and v.fecha_de_emision >= to_char(v_chunk, 'YYYY-MM-DD')
      and v.fecha_de_emision < to_char(v_chunk + 1, 'YYYY-MM-DD')
      and v.cod_articulo is not null
      and v.cod_articulo <> ''
    on conflict (content_hash) do nothing;

    get diagnostics v_chunk_ins = row_count;
    v_inserted := v_inserted + v_chunk_ins;
    v_chunk := v_chunk + 1;
  end loop;

  select count(*) into v_after from public.sales_history;

  perform public.tango_staging_run_finish(
    v_run_id, 'ok', v_inserted, v_inserted, 0, null
  );

  return jsonb_build_object(
    'entity', 'sales_history',
    'desde', v_desde,
    'inserted', v_inserted,
    'total', v_after
  );

exception when others then
  perform public.tango_staging_run_finish(
    v_run_id, 'error', 0, 0, 1, sqlerrm
  );
  raise;
end;
$$;
