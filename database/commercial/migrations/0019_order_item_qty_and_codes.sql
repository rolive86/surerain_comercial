-- SURE RAIN COMMERCIAL DB — 0019 staff qty updates + public product codes
-- Additive. Códigos Tango (Excel/product_map) no son costo interno.

create policy order_items_staff_update on public.order_items for update using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
) with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
);

create policy order_items_rep_update on public.order_items for update using (
  public.current_role() = 'sales_rep'
  and exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.customer_id in (select public.current_rep_customer_ids())
  )
) with check (
  public.current_role() = 'sales_rep'
  and exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.customer_id in (select public.current_rep_customer_ids())
  )
);

create or replace function public.catalog_product_codes(p_source_ids text[])
returns table(source_id text, cod_articulo text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pm.source_id, pm.cod_articulo
  from public.product_map pm
  where pm.source_id = any(p_source_ids);
$$;

revoke execute on function public.catalog_product_codes(text[]) from public;
grant execute on function public.catalog_product_codes(text[]) to anon, authenticated, service_role;
