-- SURE RAIN COMMERCIAL DB — 0016 tango staging (raw JSON mirror)
-- Additive. Schema tango is service-role only. No promotion to public.
-- PostgREST no expone `tango`: el loader escribe vía RPCs public.tango_staging_*
-- (EXECUTE solo service_role).

create schema if not exists tango;
revoke all on schema tango from anon, authenticated;
grant usage on schema tango to postgres, service_role;
grant all on schema tango to postgres, service_role;

-- ARTICULOS (maestro) — key: cod_articulo
create table tango.articulos_raw (
  cod_articulo text primary key,
  id_sta11     text,
  cod_barra    text,
  descripcion  text,
  familia      text,
  iva_desc     text,
  raw_payload  jsonb not null,
  content_hash text,
  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  sync_status  text default 'ok'
);
create index articulos_barcode_idx on tango.articulos_raw(cod_barra);

-- CLIENTES — key: id_gva14 ; cod_gva14 trimmeado indexado
create table tango.clientes_raw (
  id_gva14      text primary key,
  cod_gva14     text,
  razon_social  text,
  cuit          text,
  email         text,
  cod_vendedor  text,
  nro_lista     text,
  porc_desc     numeric,
  habilitado    boolean,
  raw_payload   jsonb not null,
  content_hash  text,
  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  sync_status   text default 'ok'
);
create index clientes_cod_idx on tango.clientes_raw(cod_gva14);
create index clientes_vend_idx on tango.clientes_raw(cod_vendedor);

-- VENDEDORES — key: id_gva23
create table tango.vendedores_raw (
  id_gva23     text primary key,
  cod_gva23    text,
  nombre       text,
  inhabilitado boolean,
  raw_payload  jsonb not null,
  content_hash text,
  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  sync_status  text default 'ok'
);
create index vendedores_cod_idx on tango.vendedores_raw(cod_gva23);

-- LISTAS DE PRECIOS (encabezados) — key: id_gva10
create table tango.listas_precios_raw (
  id_gva10     text primary key,
  nro_de_lis   text,
  nombre       text,
  habilitada   boolean,
  mon_cte      boolean,
  raw_payload  jsonb not null,
  content_hash text,
  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  sync_status  text default 'ok'
);
create index listas_nro_idx on tango.listas_precios_raw(nro_de_lis);

-- PRECIOS (contenido de lista) — key compuesta: (cod_lista, cod_articulo)
create table tango.precios_raw (
  cod_lista    text not null,
  cod_articulo text not null,
  precio       numeric,
  moneda       boolean,
  incluye_iva  boolean,
  fecha_ult_mod timestamptz,
  raw_payload  jsonb not null,
  content_hash text,
  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  sync_status  text default 'ok',
  primary key (cod_lista, cod_articulo)
);
create index precios_art_idx on tango.precios_raw(cod_articulo);

-- STOCK — key compuesta: (cod_articulo, cod_deposito)
create table tango.stock_raw (
  cod_articulo text not null,
  cod_deposito text not null,
  deposito_desc text,
  saldo        numeric,
  comprometida numeric,
  a_recibir    numeric,
  raw_payload  jsonb not null,
  content_hash text,
  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  sync_status  text default 'ok',
  primary key (cod_articulo, cod_deposito)
);

-- VENTAS DETALLE (historial) — append-only, surrogate + content_hash único
create table tango.ventas_detalle_raw (
  id            uuid primary key default gen_random_uuid(),
  content_hash  text unique not null,
  nro_comprobante text,
  tipo_comprobante text,
  fecha_emision timestamptz,
  cod_cliente   text,
  cod_vendedor  text,
  cod_articulo  text,
  cantidad      numeric,
  precio_unitario numeric,
  total         numeric,
  moneda        text,
  cotizacion    numeric,
  raw_payload   jsonb not null,
  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now()
);
create index ventas_cli_idx  on tango.ventas_detalle_raw(cod_cliente);
create index ventas_art_idx  on tango.ventas_detalle_raw(cod_articulo);
create index ventas_fecha_idx on tango.ventas_detalle_raw(fecha_emision);

-- TESORERIA / RECIBOS — append-only, surrogate + content_hash único
create table tango.tesoreria_raw (
  id            uuid primary key default gen_random_uuid(),
  content_hash  text unique not null,
  id_sba04      text,
  fecha         timestamptz,
  cod_cliente   text,
  comprobante   text,
  total_cte     numeric,
  moneda        text,
  cotizacion    numeric,
  raw_payload   jsonb not null,
  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now()
);
create index tesoreria_cli_idx on tango.tesoreria_raw(cod_cliente);

-- Observabilidad de corridas
create table tango.sync_runs (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  source text not null default 'json_load',
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  rows_read int default 0,
  rows_upserted int default 0,
  rows_failed int default 0,
  error text,
  meta jsonb not null default '{}'::jsonb
);

grant all on all tables in schema tango to postgres, service_role;
alter default privileges in schema tango grant all on tables to postgres, service_role;

-- Defense-in-depth (service_role bypassa RLS igual)
do $$ declare t text;
begin
  for t in select table_name from information_schema.tables where table_schema='tango'
  loop execute format('alter table tango.%I enable row level security;', t); end loop;
end $$;

-- RPCs públicas (schema public) para el loader: tango no se expone en PostgREST.
-- EXECUTE solo service_role.

create or replace function public.tango_staging_run_start(
  p_entity text,
  p_source text default 'json_load',
  p_meta jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = tango, public, pg_temp
as $$
declare
  rid uuid;
begin
  insert into tango.sync_runs (entity, source, status, meta)
  values (p_entity, coalesce(p_source, 'json_load'), 'running', coalesce(p_meta, '{}'::jsonb))
  returning id into rid;
  return rid;
end;
$$;

create or replace function public.tango_staging_run_finish(
  p_id uuid,
  p_status text,
  p_read int default 0,
  p_upserted int default 0,
  p_failed int default 0,
  p_error text default null
) returns void
language plpgsql
security definer
set search_path = tango, public, pg_temp
as $$
begin
  update tango.sync_runs
  set finished_at = now(),
      status = p_status,
      rows_read = p_read,
      rows_upserted = p_upserted,
      rows_failed = p_failed,
      error = p_error
  where id = p_id;
end;
$$;

create or replace function public.tango_staging_upsert(p_entity text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = tango, public, pg_temp
as $$
declare
  n int := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a json array';
  end if;

  if p_entity = 'articulos' then
    insert into tango.articulos_raw as t (
      cod_articulo, id_sta11, cod_barra, descripcion, familia, iva_desc,
      raw_payload, content_hash, last_synced_at, sync_status
    )
    select
      x.cod_articulo, x.id_sta11, x.cod_barra, x.descripcion, x.familia, x.iva_desc,
      x.raw_payload, x.content_hash, now(), coalesce(x.sync_status, 'ok')
    from jsonb_to_recordset(p_rows) as x(
      cod_articulo text, id_sta11 text, cod_barra text, descripcion text,
      familia text, iva_desc text, raw_payload jsonb, content_hash text, sync_status text
    )
    on conflict (cod_articulo) do update set
      id_sta11 = excluded.id_sta11,
      cod_barra = excluded.cod_barra,
      descripcion = excluded.descripcion,
      familia = excluded.familia,
      iva_desc = excluded.iva_desc,
      raw_payload = excluded.raw_payload,
      content_hash = excluded.content_hash,
      last_synced_at = now(),
      sync_status = excluded.sync_status;
  elsif p_entity = 'clientes' then
    insert into tango.clientes_raw (
      id_gva14, cod_gva14, razon_social, cuit, email, cod_vendedor, nro_lista,
      porc_desc, habilitado, raw_payload, content_hash, last_synced_at, sync_status
    )
    select
      x.id_gva14, x.cod_gva14, x.razon_social, x.cuit, x.email, x.cod_vendedor, x.nro_lista,
      x.porc_desc, x.habilitado, x.raw_payload, x.content_hash, now(), coalesce(x.sync_status, 'ok')
    from jsonb_to_recordset(p_rows) as x(
      id_gva14 text, cod_gva14 text, razon_social text, cuit text, email text,
      cod_vendedor text, nro_lista text, porc_desc numeric, habilitado boolean,
      raw_payload jsonb, content_hash text, sync_status text
    )
    on conflict (id_gva14) do update set
      cod_gva14 = excluded.cod_gva14,
      razon_social = excluded.razon_social,
      cuit = excluded.cuit,
      email = excluded.email,
      cod_vendedor = excluded.cod_vendedor,
      nro_lista = excluded.nro_lista,
      porc_desc = excluded.porc_desc,
      habilitado = excluded.habilitado,
      raw_payload = excluded.raw_payload,
      content_hash = excluded.content_hash,
      last_synced_at = now(),
      sync_status = excluded.sync_status;
  elsif p_entity = 'vendedores' then
    insert into tango.vendedores_raw (
      id_gva23, cod_gva23, nombre, inhabilitado, raw_payload, content_hash, last_synced_at, sync_status
    )
    select
      x.id_gva23, x.cod_gva23, x.nombre, x.inhabilitado, x.raw_payload, x.content_hash, now(), coalesce(x.sync_status, 'ok')
    from jsonb_to_recordset(p_rows) as x(
      id_gva23 text, cod_gva23 text, nombre text, inhabilitado boolean,
      raw_payload jsonb, content_hash text, sync_status text
    )
    on conflict (id_gva23) do update set
      cod_gva23 = excluded.cod_gva23,
      nombre = excluded.nombre,
      inhabilitado = excluded.inhabilitado,
      raw_payload = excluded.raw_payload,
      content_hash = excluded.content_hash,
      last_synced_at = now(),
      sync_status = excluded.sync_status;
  elsif p_entity = 'listas_precios' then
    insert into tango.listas_precios_raw (
      id_gva10, nro_de_lis, nombre, habilitada, mon_cte, raw_payload, content_hash, last_synced_at, sync_status
    )
    select
      x.id_gva10, x.nro_de_lis, x.nombre, x.habilitada, x.mon_cte, x.raw_payload, x.content_hash, now(), coalesce(x.sync_status, 'ok')
    from jsonb_to_recordset(p_rows) as x(
      id_gva10 text, nro_de_lis text, nombre text, habilitada boolean, mon_cte boolean,
      raw_payload jsonb, content_hash text, sync_status text
    )
    on conflict (id_gva10) do update set
      nro_de_lis = excluded.nro_de_lis,
      nombre = excluded.nombre,
      habilitada = excluded.habilitada,
      mon_cte = excluded.mon_cte,
      raw_payload = excluded.raw_payload,
      content_hash = excluded.content_hash,
      last_synced_at = now(),
      sync_status = excluded.sync_status;
  elsif p_entity = 'precios' then
    insert into tango.precios_raw (
      cod_lista, cod_articulo, precio, moneda, incluye_iva, fecha_ult_mod,
      raw_payload, content_hash, last_synced_at, sync_status
    )
    select
      x.cod_lista, x.cod_articulo, x.precio, x.moneda, x.incluye_iva, x.fecha_ult_mod,
      x.raw_payload, x.content_hash, now(), coalesce(x.sync_status, 'ok')
    from jsonb_to_recordset(p_rows) as x(
      cod_lista text, cod_articulo text, precio numeric, moneda boolean, incluye_iva boolean,
      fecha_ult_mod timestamptz, raw_payload jsonb, content_hash text, sync_status text
    )
    on conflict (cod_lista, cod_articulo) do update set
      precio = excluded.precio,
      moneda = excluded.moneda,
      incluye_iva = excluded.incluye_iva,
      fecha_ult_mod = excluded.fecha_ult_mod,
      raw_payload = excluded.raw_payload,
      content_hash = excluded.content_hash,
      last_synced_at = now(),
      sync_status = excluded.sync_status;
  elsif p_entity = 'stock' then
    insert into tango.stock_raw (
      cod_articulo, cod_deposito, deposito_desc, saldo, comprometida, a_recibir,
      raw_payload, content_hash, last_synced_at, sync_status
    )
    select
      x.cod_articulo, x.cod_deposito, x.deposito_desc, x.saldo, x.comprometida, x.a_recibir,
      x.raw_payload, x.content_hash, now(), coalesce(x.sync_status, 'ok')
    from jsonb_to_recordset(p_rows) as x(
      cod_articulo text, cod_deposito text, deposito_desc text, saldo numeric,
      comprometida numeric, a_recibir numeric, raw_payload jsonb, content_hash text, sync_status text
    )
    on conflict (cod_articulo, cod_deposito) do update set
      deposito_desc = excluded.deposito_desc,
      saldo = excluded.saldo,
      comprometida = excluded.comprometida,
      a_recibir = excluded.a_recibir,
      raw_payload = excluded.raw_payload,
      content_hash = excluded.content_hash,
      last_synced_at = now(),
      sync_status = excluded.sync_status;
  elsif p_entity = 'ventas_detalle' then
    insert into tango.ventas_detalle_raw (
      content_hash, nro_comprobante, tipo_comprobante, fecha_emision, cod_cliente,
      cod_vendedor, cod_articulo, cantidad, precio_unitario, total, moneda, cotizacion, raw_payload
    )
    select
      x.content_hash, x.nro_comprobante, x.tipo_comprobante, x.fecha_emision, x.cod_cliente,
      x.cod_vendedor, x.cod_articulo, x.cantidad, x.precio_unitario, x.total, x.moneda, x.cotizacion, x.raw_payload
    from jsonb_to_recordset(p_rows) as x(
      content_hash text, nro_comprobante text, tipo_comprobante text, fecha_emision timestamptz,
      cod_cliente text, cod_vendedor text, cod_articulo text, cantidad numeric,
      precio_unitario numeric, total numeric, moneda text, cotizacion numeric, raw_payload jsonb
    )
    on conflict (content_hash) do nothing;
  elsif p_entity = 'tesoreria' then
    insert into tango.tesoreria_raw (
      content_hash, id_sba04, fecha, cod_cliente, comprobante, total_cte, moneda, cotizacion, raw_payload
    )
    select
      x.content_hash, x.id_sba04, x.fecha, x.cod_cliente, x.comprobante, x.total_cte, x.moneda, x.cotizacion, x.raw_payload
    from jsonb_to_recordset(p_rows) as x(
      content_hash text, id_sba04 text, fecha timestamptz, cod_cliente text, comprobante text,
      total_cte numeric, moneda text, cotizacion numeric, raw_payload jsonb
    )
    on conflict (content_hash) do nothing;
  else
    raise exception 'unknown tango entity: %', p_entity;
  end if;

  get diagnostics n = row_count;
  return jsonb_build_object('upserted', n);
end;
$$;

revoke all on function public.tango_staging_run_start(text, text, jsonb) from public;
revoke all on function public.tango_staging_run_finish(uuid, text, int, int, int, text) from public;
revoke all on function public.tango_staging_upsert(text, jsonb) from public;
revoke execute on function public.tango_staging_run_start(text, text, jsonb) from anon, authenticated;
revoke execute on function public.tango_staging_run_finish(uuid, text, int, int, int, text) from anon, authenticated;
revoke execute on function public.tango_staging_upsert(text, jsonb) from anon, authenticated;
grant execute on function public.tango_staging_run_start(text, text, jsonb) to service_role;
grant execute on function public.tango_staging_run_finish(uuid, text, int, int, int, text) to service_role;
grant execute on function public.tango_staging_upsert(text, jsonb) to service_role;
