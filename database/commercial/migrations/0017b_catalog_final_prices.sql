-- Cliente no lee product_map (staff-only). RPC SECURITY DEFINER
-- resuelve source_id → effective_prices.final_amount sin exponer base.

create or replace function public.catalog_final_prices(p_source_ids text[])
returns table(source_id text, final_amount numeric, currency text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    pm.source_id,
    coalesce(epc.final_amount, epd.final_amount) as final_amount,
    coalesce(epc.currency, epd.currency) as currency
  from public.product_map pm
  left join public.effective_prices epc
    on epc.cod_articulo = pm.cod_articulo
   and epc.customer_id is not null
   and epc.customer_id = public.current_customer_id()
  left join public.effective_prices epd
    on epd.cod_articulo = pm.cod_articulo
   and epd.customer_id is null
  where pm.source_id = any(p_source_ids)
    and coalesce(epc.final_amount, epd.final_amount) is not null
    and public.current_role() in (
      'customer_user', 'sales_rep', 'sales_manager', 'operations', 'admin'
    );
$$;

revoke execute on function public.catalog_final_prices(text[]) from public;
revoke execute on function public.catalog_final_prices(text[]) from anon;
grant execute on function public.catalog_final_prices(text[]) to authenticated;
grant execute on function public.catalog_final_prices(text[]) to service_role;
