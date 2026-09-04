-- SURE RAIN COMMERCIAL DB — 0014 pricing model (empty, Tango deferred)
-- Additive. Tablas vacías; sin schema tango ni datos. Columnas tango_* nullable.

create table public.price_lists (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  currency text not null default 'ARS',
  active boolean not null default true,
  external_id text,
  tango_price_list_id text,
  source_system text not null default 'platform',
  last_synced_at timestamptz,
  sync_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger price_lists_set_updated_at before update on public.price_lists
  for each row execute function public.set_updated_at();

create table public.prices (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  product_source_id text not null,
  amount numeric not null,
  compare_at_amount numeric,
  unit text,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  external_id text,
  tango_id text,
  last_synced_at timestamptz,
  sync_status text,
  created_at timestamptz not null default now(),
  unique (price_list_id, product_source_id, valid_from)
);

create index prices_list_idx on public.prices(price_list_id);
create index prices_product_idx on public.prices(product_source_id);

create table public.customer_price_list (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  active boolean not null default true,
  external_id text,
  tango_id text,
  source_system text not null default 'platform',
  last_synced_at timestamptz,
  sync_status text,
  created_at timestamptz not null default now()
);

create index cpl_customer_idx on public.customer_price_list(customer_id) where active;

create or replace function public.current_customer_price_list_ids() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select cpl.price_list_id
  from public.customer_price_list cpl
  where cpl.customer_id = public.current_customer_id() and cpl.active
    and (cpl.valid_to is null or cpl.valid_to > now())
$$;

revoke execute on function public.current_customer_price_list_ids() from anon, public;
grant execute on function public.current_customer_price_list_ids() to authenticated;
