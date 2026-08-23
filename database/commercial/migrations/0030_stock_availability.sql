-- Stock: real (Tango) vs comprometido (cotizaciones vivas) vs libre.

create or replace view public.v_stock_availability as
select
  pt.cod_articulo,
  coalesce(pt.stock_qty, 0)::numeric as stock_real,
  coalesce(comp.qty, 0)::numeric as comprometido,
  (coalesce(pt.stock_qty, 0) - coalesce(comp.qty, 0))::numeric as libre
from public.products_tango pt
left join (
  select
    coalesce(
      nullif(oi.sku_snapshot, ''),
      pm.cod_articulo,
      oi.product_source_id
    ) as cod_articulo,
    sum(oi.quantity)::numeric as qty
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  left join public.product_map pm on pm.source_id = oi.product_source_id
  where o.status in ('submitted', 'quoted', 'sent')
  group by 1
) comp on comp.cod_articulo = pt.cod_articulo
where pt.active;

grant select on public.v_stock_availability to service_role;
-- No grant a authenticated: el cliente no debe leer comprometido vía vista.
-- Staff/rep usan la función security definer.

create or replace function public.stock_availability(p_cod_articulo text)
returns table(stock_real numeric, comprometido numeric, libre numeric)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    v.stock_real,
    v.comprometido,
    v.libre
  from public.v_stock_availability v
  where v.cod_articulo = p_cod_articulo
    and public.current_role() in ('sales_rep', 'sales_manager', 'operations', 'admin');
$$;

revoke execute on function public.stock_availability(text) from public;
revoke execute on function public.stock_availability(text) from anon;
grant execute on function public.stock_availability(text) to authenticated;
grant execute on function public.stock_availability(text) to service_role;

-- Batch helper for staff UIs
create or replace function public.stock_availability_many(p_codes text[])
returns table(
  cod_articulo text,
  stock_real numeric,
  comprometido numeric,
  libre numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    v.cod_articulo,
    v.stock_real,
    v.comprometido,
    v.libre
  from public.v_stock_availability v
  where v.cod_articulo = any (p_codes)
    and public.current_role() in ('sales_rep', 'sales_manager', 'operations', 'admin');
$$;

revoke execute on function public.stock_availability_many(text[]) from public;
revoke execute on function public.stock_availability_many(text[]) from anon;
grant execute on function public.stock_availability_many(text[]) to authenticated;
grant execute on function public.stock_availability_many(text[]) to service_role;
