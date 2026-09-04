-- 0017c: recompute no puede hacer DELETE sin WHERE (PostgREST/guard).
create or replace function public.recompute_effective_prices() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.effective_prices where id is not null;
  insert into public.effective_prices (cod_articulo, customer_id, final_amount, currency)
  select p.product_source_id as cod_articulo, null,
         round(p.amount * (1 + coalesce(m.percent, 0) / 100.0), 2), 'USD'
  from public.prices p
  left join lateral (
    select mm.percent
    from public.margins mm
    where mm.active and mm.customer_id is null
      and (
        (mm.scope = 'product' and mm.cod_articulo = p.product_source_id)
        or (mm.scope = 'category' and mm.category = (
          select pm.tango_desc from public.product_map pm
          where pm.cod_articulo = p.product_source_id limit 1
        ))
        or mm.scope = 'global'
      )
    order by case mm.scope when 'product' then 1 when 'category' then 2 else 3 end
    limit 1
  ) m on true
  where p.price_list_id = (select id from public.price_lists where code = '29' limit 1);
end;
$$;

revoke execute on function public.recompute_effective_prices() from public;
revoke execute on function public.recompute_effective_prices() from anon, authenticated;
grant execute on function public.recompute_effective_prices() to service_role;
