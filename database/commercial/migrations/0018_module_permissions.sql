-- SURE RAIN COMMERCIAL DB — 0018 module permissions (UX toggles, not RLS)
create table public.app_modules (
  code text primary key,
  label text not null,
  sort_order int not null default 0
);

create table public.module_permissions (
  role text not null check (role in ('customer_user','sales_rep','sales_manager','operations','admin')),
  module text not null references public.app_modules(code) on delete cascade,
  can_view boolean not null default true,
  can_edit boolean not null default false,
  primary key (role, module)
);

alter table public.app_modules enable row level security;
alter table public.module_permissions enable row level security;

create policy modules_read on public.app_modules
  for select to authenticated using (true);
create policy modperm_read on public.module_permissions
  for select to authenticated using (true);

insert into public.app_modules (code, label, sort_order) values
  ('catalogo', 'Catálogo', 10),
  ('carrito', 'Carrito / pedido', 20),
  ('mis_pedidos', 'Mis compras', 30),
  ('seguir_pedido', 'Seguir pedido', 40),
  ('cuenta', 'Cuenta', 50),
  ('gestion_pedidos', 'Gestión · Pedidos', 60),
  ('gestion_clientes', 'Gestión · Clientes', 70),
  ('gestion_vendedores', 'Gestión · Vendedores', 80),
  ('admin_console', 'Consola admin (márgenes/precios/mapeo)', 90);

insert into public.module_permissions (role, module, can_view, can_edit)
select r.role, m.code,
  case
    when r.role = 'customer_user' and m.code in ('catalogo','carrito','mis_pedidos','seguir_pedido','cuenta') then true
    when r.role = 'sales_rep' and m.code in ('catalogo','cuenta','gestion_pedidos','gestion_clientes','gestion_vendedores') then true
    when r.role = 'operations' and m.code in ('catalogo','cuenta','gestion_pedidos','gestion_clientes','gestion_vendedores') then true
    when r.role in ('sales_manager','admin') then true
    else false
  end,
  case
    when r.role in ('sales_manager','admin') and m.code in ('gestion_pedidos','gestion_clientes','gestion_vendedores','admin_console') then true
    when r.role = 'operations' and m.code in ('gestion_pedidos','gestion_clientes','gestion_vendedores') then true
    when r.role = 'sales_rep' and m.code in ('gestion_pedidos','gestion_clientes') then true
    else false
  end
from public.app_modules m
cross join (values
  ('customer_user'),
  ('sales_rep'),
  ('sales_manager'),
  ('operations'),
  ('admin')
) as r(role);
