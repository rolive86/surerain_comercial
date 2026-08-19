-- SURE RAIN COMMERCIAL DB — 0017 pricing margins + product_map + effective_prices
-- Additive. Base prices staff-only. Cliente lee solo effective_prices (final).
-- PK de effective_prices: no se usa (cod_articulo, customer_id) porque customer_id
-- null no puede ir en PRIMARY KEY; unicidad vía índices parciales.

-- 1) Base prices / listas: solo staff
drop policy if exists prices_customer_read on public.prices;
drop policy if exists prices_rep_read on public.prices;
drop policy if exists pl_customer_read on public.price_lists;
drop policy if exists pl_rep_read on public.price_lists;

-- 2) Mapeo catálogo (source_id) <-> Tango (cod_articulo)
create table public.product_map (
  source_id    text primary key,
  cod_articulo text not null,
  barcode      text,
  catalog_name text,
  tango_desc   text,
  match_method text,
  confidence   numeric,
  confirmed    boolean not null default false,
  created_at   timestamptz not null default now()
);
create unique index product_map_cod_idx on public.product_map(cod_articulo);

-- 3) Márgenes
create table public.margins (
  id           uuid primary key default gen_random_uuid(),
  scope        text not null check (scope in ('global','category','product','customer')),
  category     text,
  cod_articulo text,
  customer_id  uuid references public.customers(id),
  percent      numeric not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger margins_set_updated_at before update on public.margins
  for each row execute function public.set_updated_at();

-- 4) Precios finales (sin base ni margen)
create table public.effective_prices (
  id           uuid primary key default gen_random_uuid(),
  cod_articulo text not null,
  customer_id  uuid,
  final_amount numeric not null,
  currency     text not null default 'USD',
  computed_at  timestamptz not null default now()
);
create unique index effprices_default_idx
  on public.effective_prices(cod_articulo) where customer_id is null;
create unique index effprices_customer_idx
  on public.effective_prices(cod_articulo, customer_id) where customer_id is not null;

-- 5) Specs Excel (staging tango, no expuesto)
create table if not exists tango.articulos_specs_raw (
  cod_articulo text primary key,
  categoria    text,
  descripcion  text,
  precio_usd   numeric,
  specs        jsonb not null default '{}'::jsonb,
  raw_payload  jsonb not null,
  content_hash text,
  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  sync_status  text default 'ok'
);
alter table tango.articulos_specs_raw enable row level security;
grant all on table tango.articulos_specs_raw to postgres, service_role;

-- 6) RLS public
alter table public.product_map enable row level security;
alter table public.margins enable row level security;
alter table public.effective_prices enable row level security;

create policy pmap_staff on public.product_map for select using (
  public.current_role() in ('sales_manager','operations','admin')
);
create policy margins_staff on public.margins for select using (
  public.current_role() in ('sales_manager','operations','admin')
);

create policy eff_customer_read on public.effective_prices for select using (
  public.current_role() = 'customer_user'
  and (customer_id is null or customer_id = public.current_customer_id())
);
create policy eff_rep_read on public.effective_prices for select using (
  public.current_role() = 'sales_rep'
  and (customer_id is null or customer_id in (select public.current_rep_customer_ids()))
);
create policy eff_staff_read on public.effective_prices for select using (
  public.current_role() in ('sales_manager','operations','admin')
);

-- 7) Recompute final = base * (1 + margen). SECURITY DEFINER.
create or replace function public.recompute_effective_prices() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.effective_prices where id is not null;
  insert into public.effective_prices (cod_articulo, customer_id, final_amount, currency)
  select p.product_source_id as cod_articulo, null,
         round(p.amount * (1 + coalesce(m.percent, 0) / 100.0), 2), 'USD'
  from public.prices p
  left join lateral (
    select mm.percent
    from public.margins mm
    where mm.active and mm.customer_id is null
      and (
        (mm.scope = 'product' and mm.cod_articulo = p.product_source_id)
        or (mm.scope = 'category' and mm.category = (
          select pm.tango_desc from public.product_map pm
          where pm.cod_articulo = p.product_source_id limit 1
        ))
        or mm.scope = 'global'
      )
    order by case mm.scope when 'product' then 1 when 'category' then 2 else 3 end
    limit 1
  ) m on true
  where p.price_list_id = (select id from public.price_lists where code = '29' limit 1);
end;
$$;

revoke execute on function public.recompute_effective_prices() from public;
revoke execute on function public.recompute_effective_prices() from anon, authenticated;
grant execute on function public.recompute_effective_prices() to service_role;

-- 8) Fetch tango staging (schema no expuesto a PostgREST)
create or replace function public.tango_staging_fetch(p_entity text)
returns jsonb
language plpgsql security definer set search_path = tango, public, pg_temp as $$
begin
  if p_entity = 'articulos' then
    return coalesce((select jsonb_agg(to_jsonb(t)) from tango.articulos_raw t), '[]'::jsonb);
  elsif p_entity = 'listas_precios' then
    return coalesce((select jsonb_agg(to_jsonb(t)) from tango.listas_precios_raw t), '[]'::jsonb);
  elsif p_entity = 'precios' then
    return coalesce((select jsonb_agg(to_jsonb(t)) from tango.precios_raw t), '[]'::jsonb);
  elsif p_entity = 'articulos_specs' then
    return coalesce((select jsonb_agg(to_jsonb(t)) from tango.articulos_specs_raw t), '[]'::jsonb);
  else
    raise exception 'unknown tango fetch entity: %', p_entity;
  end if;
end;
$$;

revoke execute on function public.tango_staging_fetch(text) from public;
revoke execute on function public.tango_staging_fetch(text) from anon, authenticated;
grant execute on function public.tango_staging_fetch(text) to service_role;

create or replace function public.tango_specs_upsert(p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = tango, public, pg_temp as $$
declare
  n int := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a json array';
  end if;
  insert into tango.articulos_specs_raw as t (
    cod_articulo, categoria, descripcion, precio_usd, specs, raw_payload,
    content_hash, last_synced_at, sync_status
  )
  select
    x.cod_articulo, x.categoria, x.descripcion, x.precio_usd, coalesce(x.specs, '{}'::jsonb),
    x.raw_payload, x.content_hash, now(), coalesce(x.sync_status, 'ok')
  from jsonb_to_recordset(p_rows) as x(
    cod_articulo text, categoria text, descripcion text, precio_usd numeric,
    specs jsonb, raw_payload jsonb, content_hash text, sync_status text
  )
  on conflict (cod_articulo) do update set
    categoria = excluded.categoria,
    descripcion = excluded.descripcion,
    precio_usd = excluded.precio_usd,
    specs = excluded.specs,
    raw_payload = excluded.raw_payload,
    content_hash = excluded.content_hash,
    last_synced_at = now(),
    sync_status = excluded.sync_status;
  get diagnostics n = row_count;
  return jsonb_build_object('upserted', n);
end;
$$;

revoke execute on function public.tango_specs_upsert(jsonb) from public;
revoke execute on function public.tango_specs_upsert(jsonb) from anon, authenticated;
grant execute on function public.tango_specs_upsert(jsonb) to service_role;
