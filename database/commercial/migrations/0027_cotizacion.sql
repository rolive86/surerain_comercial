-- Cotización: markup por cliente, estados quoted/sent, sin precios al cliente.

-- 1) Config comercial por cliente (platform-owned; no la pisa el sync Tango)
create table if not exists public.customer_pricing (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  markup_pct  numeric not null default 0,
  currency    text not null default 'USD',
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now()
);

alter table public.customer_pricing enable row level security;

drop policy if exists cp_admin_all on public.customer_pricing;
create policy cp_admin_all on public.customer_pricing
  for select using (public.current_role() in ('sales_manager','operations','admin'));

drop policy if exists cp_rep_read on public.customer_pricing;
create policy cp_rep_read on public.customer_pricing
  for select using (
    public.current_role() = 'sales_rep'
    and customer_id in (select public.current_rep_customer_ids())
  );

grant select on public.customer_pricing to authenticated;
grant all on public.customer_pricing to service_role;

-- 2) Estados de cotización
insert into public.order_statuses (code, label, sort_order, is_terminal)
values
  ('quoted', 'Cotizada', 35, false),
  ('sent', 'Enviada', 38, false)
on conflict (code) do nothing;

-- 3) Campos de cotización en orders
alter table public.orders
  add column if not exists pdf_url text,
  add column if not exists quote_valid_until timestamptz,
  add column if not exists whatsapp_phone text;

-- 4) CLIENTE NO VE PRECIOS
drop policy if exists eff_customer_read on public.effective_prices;
drop policy if exists prices_customer_read on public.prices;
drop policy if exists pl_customer_read on public.price_lists;
drop policy if exists cpl_customer_read on public.customer_price_list;

drop policy if exists prices_rep_read on public.prices;
create policy prices_rep_read on public.prices
  for select using (public.current_role() = 'sales_rep');

drop policy if exists pl_rep_read on public.price_lists;
create policy pl_rep_read on public.price_lists
  for select using (public.current_role() = 'sales_rep');

-- catalog_final_prices: ya no para customer_user
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
      'sales_rep', 'sales_manager', 'operations', 'admin'
    );
$$;

revoke execute on function public.catalog_final_prices(text[]) from public;
revoke execute on function public.catalog_final_prices(text[]) from anon;
grant execute on function public.catalog_final_prices(text[]) to authenticated;
grant execute on function public.catalog_final_prices(text[]) to service_role;

-- 5) Precio de cotización: base lista 29 × (1 + markup_pct/100)
create or replace function public.quote_unit_price(p_cod_articulo text, p_customer uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.current_role() not in ('sales_rep','sales_manager','operations','admin')
      then null
    when public.current_role() = 'sales_rep'
      and not exists (
        select 1 from public.current_rep_customer_ids() x where x = p_customer
      )
      then null
    else round(
      (
        select p.amount
        from public.prices p
        where p.product_source_id = p_cod_articulo
          and p.price_list_id = (select id from public.price_lists where code = '29' limit 1)
        order by p.valid_from desc
        limit 1
      )
      * (
        1 + coalesce(
          (select markup_pct from public.customer_pricing where customer_id = p_customer),
          (select percent from public.margins where scope = 'global' and active limit 1),
          0
        ) / 100.0
      ),
      2
    )
  end;
$$;

revoke execute on function public.quote_unit_price(text, uuid) from public;
revoke execute on function public.quote_unit_price(text, uuid) from anon;
grant execute on function public.quote_unit_price(text, uuid) to authenticated;
grant execute on function public.quote_unit_price(text, uuid) to service_role;
