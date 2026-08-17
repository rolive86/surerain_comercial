-- SURE RAIN COMMERCIAL DB — 0012 user profiles, avatars, recommendation views (Pass 2)
-- Additive. Views con security_invoker para heredar RLS de orders.

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  position text,
  avatar_path text,
  interests jsonb not null default '[]'::jsonb,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_profiles_set_updated_at before update on public.user_profiles
  for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;

create policy up_self_rw on public.user_profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy up_staff_read on public.user_profiles for select
  using (public.current_role() in ('sales_manager','operations','admin'));

-- Frecuencia por producto (scoped por RLS de orders / order_items)
create or replace view public.v_customer_product_frequency
with (security_invoker = true) as
select
  o.customer_id,
  oi.product_source_id,
  count(distinct o.id) as veces_pedido,
  sum(oi.quantity) as unidades_totales,
  max(o.submitted_at) as ultima_vez,
  min(o.submitted_at) as primera_vez
from public.orders o
join public.order_items oi on oi.order_id = o.id
where o.status not in ('cancelled', 'rejected')
group by o.customer_id, oi.product_source_id;

-- Co-ocurrencia (clientes también pidieron)
create or replace view public.v_customer_product_pairs
with (security_invoker = true) as
select
  o.customer_id,
  a.product_source_id as product_a,
  b.product_source_id as product_b,
  count(distinct o.id) as juntos
from public.orders o
join public.order_items a on a.order_id = o.id
join public.order_items b
  on b.order_id = o.id
  and a.product_source_id < b.product_source_id
where o.status not in ('cancelled', 'rejected')
group by o.customer_id, a.product_source_id, b.product_source_id;

grant select on public.v_customer_product_frequency to authenticated;
grant select on public.v_customer_product_pairs to authenticated;

-- Bucket avatars: lectura pública, escritura sólo del dueño (carpeta = user_id)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_public_read on storage.objects;
drop policy if exists avatars_owner_insert on storage.objects;
drop policy if exists avatars_owner_update on storage.objects;
drop policy if exists avatars_owner_delete on storage.objects;

create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

create policy avatars_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy avatars_owner_update on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy avatars_owner_delete on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
