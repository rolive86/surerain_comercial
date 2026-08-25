-- Producto padre + variantes (medida/rosca) sobre códigos Tango sueltos.

create table if not exists public.product_groups (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  familia text,
  needs_review boolean not null default false,
  source text not null default 'auto'
    check (source in ('auto', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  cod_articulo text primary key
    references public.products_tango (cod_articulo) on delete cascade,
  group_id uuid references public.product_groups (id) on delete set null,
  variant_label text,
  sort_order int not null default 0
);

create index if not exists pv_group_idx on public.product_variants (group_id);
create index if not exists pg_needs_review_idx on public.product_groups (needs_review)
  where needs_review;
create index if not exists pg_name_idx on public.product_groups (name);

alter table public.product_groups enable row level security;
alter table public.product_variants enable row level security;

drop policy if exists pg_read on public.product_groups;
create policy pg_read on public.product_groups
  for select to authenticated
  using (true);

drop policy if exists pv_read on public.product_variants;
create policy pv_read on public.product_variants
  for select to authenticated
  using (true);

grant select on public.product_groups to authenticated;
grant select on public.product_variants to authenticated;
grant all on public.product_groups to service_role;
grant all on public.product_variants to service_role;
