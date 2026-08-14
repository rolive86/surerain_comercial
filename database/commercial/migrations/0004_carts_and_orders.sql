-- SURE RAIN COMMERCIAL DB — 0004 carts and orders (Fase C)

create sequence if not exists public.order_number_seq;

create or replace function public.next_order_number()
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := nextval('public.order_number_seq');
  return 'SR-' || to_char(timezone('utc', now()), 'YYYY') || '-' || lpad(n::text, 5, '0');
end;
$$;

-- ============ CARTS ============
create table public.carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  status      text not null default 'open'
                check (status in ('open', 'converted', 'abandoned')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger carts_set_updated_at before update on public.carts
  for each row execute function public.set_updated_at();

create unique index carts_one_open_per_user_idx
  on public.carts (user_id) where (status = 'open');

create index carts_customer_idx on public.carts (customer_id);

create table public.cart_items (
  id                    uuid primary key default gen_random_uuid(),
  cart_id               uuid not null references public.carts(id) on delete cascade,
  product_source_id     text not null,
  product_name_snapshot text not null,
  product_slug_snapshot text,
  quantity              numeric not null check (quantity > 0),
  unit_snapshot         text,
  added_at              timestamptz not null default now(),
  unique (cart_id, product_source_id)
);

create index cart_items_cart_idx on public.cart_items (cart_id);

-- ============ ORDERS ============
create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text unique not null,
  customer_id     uuid not null references public.customers(id),
  user_id         uuid not null references auth.users(id),
  sales_rep_id    uuid references public.sales_reps(id),
  status          text not null references public.order_statuses(code),
  submitted_at    timestamptz,
  source          text not null default 'portal',
  external_id     text,
  tango_id        text,
  last_synced_at  timestamptz,
  sync_status     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create index orders_customer_idx on public.orders (customer_id);
create index orders_user_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status);
create index orders_sales_rep_idx on public.orders (sales_rep_id);

create table public.order_items (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.orders(id) on delete cascade,
  product_source_id     text not null,
  product_name_snapshot text not null,
  product_slug_snapshot text,
  sku_snapshot          text,
  description_snapshot  text,
  unit_snapshot         text,
  quantity              numeric not null check (quantity > 0),
  unit_price_snapshot   numeric,
  discount_snapshot     numeric,
  metadata_snapshot     jsonb not null default '{}'::jsonb
);

create index order_items_order_idx on public.order_items (order_id);

create table public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  from_status text references public.order_statuses(code),
  to_status   text not null references public.order_statuses(code),
  changed_by  uuid references auth.users(id),
  comment     text,
  created_at  timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id);

create table public.order_notes (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  note_type      text not null check (note_type in ('customer', 'internal')),
  body           text not null,
  author_user_id uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create index order_notes_order_idx on public.order_notes (order_id);

create table public.order_addresses (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  kind         text not null default 'shipping',
  company      text,
  contact      text,
  address      text,
  city         text,
  province     text,
  postal_code  text,
  observations text
);

create index order_addresses_order_idx on public.order_addresses (order_id);
