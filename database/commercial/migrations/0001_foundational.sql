-- SURE RAIN COMMERCIAL DB — 0001 foundational
create extension if not exists pgcrypto;

-- updated_at trigger helper
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

-- ============ CUSTOMERS ============
create table public.customers (
  id                uuid primary key default gen_random_uuid(),
  external_id       text,
  tango_customer_id text,
  source_system     text not null default 'platform',
  legal_name        text not null,
  trade_name        text,
  cuit              text,
  tax_condition     text,
  email             text,
  phone             text,
  address           text,
  city              text,
  province          text,
  postal_code       text,
  active            boolean not null default true,
  last_synced_at    timestamptz,
  sync_status       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

create index customers_tango_idx on public.customers(tango_customer_id);

-- ============ CUSTOMER CONTACTS ============
create table public.customer_contacts (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name        text,
  email       text,
  phone       text,
  position    text,
  is_primary  boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index customer_contacts_customer_idx on public.customer_contacts(customer_id);

-- ============ SALES REPS ============
create table public.sales_reps (
  id                 uuid primary key default gen_random_uuid(),
  external_id        text,
  tango_sales_rep_id text,
  source_system      text not null default 'platform',
  name               text not null,
  email              text,
  active             boolean not null default true,
  last_synced_at     timestamptz,
  sync_status        text,
  created_at         timestamptz not null default now()
);

-- ============ ASIGNACIÓN CLIENTE↔VENDEDOR (con histórico) ============
create table public.customer_sales_rep (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  sales_rep_id uuid not null references public.sales_reps(id) on delete cascade,
  valid_from   timestamptz not null default now(),
  valid_to     timestamptz,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index csr_customer_idx on public.customer_sales_rep(customer_id) where active;
create index csr_rep_idx on public.customer_sales_rep(sales_rep_id) where active;

-- ============ PUENTE auth.users ↔ entidad comercial + rol ============
create table public.app_user_links (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in
                 ('customer_user','sales_rep','sales_manager','operations','admin')),
  customer_id  uuid references public.customers(id),
  sales_rep_id uuid references public.sales_reps(id),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  -- coherencia: customer_user requiere customer_id; sales_rep requiere sales_rep_id
  constraint chk_customer_user check (role <> 'customer_user' or customer_id is not null),
  constraint chk_sales_rep    check (role <> 'sales_rep'     or sales_rep_id is not null)
);

-- ============ ESTADOS DE PEDIDO (datos, no enum) ============
create table public.order_statuses (
  code        text primary key,
  label       text not null,
  sort_order  int not null,
  is_terminal boolean not null default false,
  active      boolean not null default true
);

-- ============ AUDIT LOG ============
create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  action        text not null,
  entity_type   text not null,
  entity_id     uuid,
  before        jsonb,
  after         jsonb,
  created_at    timestamptz not null default now()
);

create index audit_entity_idx on public.audit_log(entity_type, entity_id);
