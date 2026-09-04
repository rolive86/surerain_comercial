-- Pedible Tango-driven (empresa 3): materialización local precio O stock.
-- Lectura portal autenticado; precio final sigue en effective_prices.

create table if not exists public.products_tango (
  cod_articulo text primary key,
  descripcion text,
  familia text,
  cod_barra text,
  unidad text,
  catalog_source_id text,
  image_url text,
  has_price boolean not null default false,
  has_stock boolean not null default false,
  stock_qty numeric,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists products_tango_familia_idx on public.products_tango (familia);
create index if not exists products_tango_barcode_idx on public.products_tango (cod_barra);
create index if not exists products_tango_active_idx on public.products_tango (active) where active;

alter table public.products_tango enable row level security;

drop policy if exists pt_read on public.products_tango;
create policy pt_read on public.products_tango
  for select to authenticated
  using (active);

grant select on public.products_tango to authenticated;
grant all on public.products_tango to service_role;

-- Precio final por source_id de catálogo scrap O por cod_articulo Tango directo.
create or replace function public.catalog_final_prices(p_source_ids text[])
returns table(source_id text, final_amount numeric, currency text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with ids as (
    select distinct x as sid from unnest(p_source_ids) as x where x is not null and x <> ''
  ),
  resolved as (
    select
      i.sid as source_id,
      coalesce(pm.cod_articulo, i.sid) as cod_articulo
    from ids i
    left join public.product_map pm on pm.source_id = i.sid
  )
  select
    r.source_id,
    coalesce(epc.final_amount, epd.final_amount) as final_amount,
    coalesce(epc.currency, epd.currency) as currency
  from resolved r
  left join public.effective_prices epc
    on epc.cod_articulo = r.cod_articulo
   and epc.customer_id is not null
   and epc.customer_id = public.current_customer_id()
  left join public.effective_prices epd
    on epd.cod_articulo = r.cod_articulo
   and epd.customer_id is null
  where coalesce(epc.final_amount, epd.final_amount) is not null
    and public.current_role() in (
      'customer_user', 'sales_rep', 'sales_manager', 'operations', 'admin'
    );
$$;

revoke execute on function public.catalog_final_prices(text[]) from public;
revoke execute on function public.catalog_final_prices(text[]) from anon;
grant execute on function public.catalog_final_prices(text[]) to authenticated;
grant execute on function public.catalog_final_prices(text[]) to service_role;
