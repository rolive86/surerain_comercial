-- SURE RAIN COMMERCIAL DB — 0020 category margin uses Tango familia
-- Additive. Fallback a specs.categoria si articulos_raw.familia está vacío (dump chico).

alter table public.margins drop constraint if exists margins_percent_range;
alter table public.margins
  add constraint margins_percent_range check (percent >= -100 and percent <= 500);

create or replace function public.recompute_effective_prices() returns void
language plpgsql
security definer
set search_path = public, tango, pg_temp
as $$
begin
  delete from public.effective_prices where id is not null;
  insert into public.effective_prices (cod_articulo, customer_id, final_amount, currency)
  select p.product_source_id as cod_articulo, null,
         round(p.amount * (1 + coalesce(m.percent, 0) / 100.0), 2), 'USD'
  from public.prices p
  left join tango.articulos_raw ar on ar.cod_articulo = p.product_source_id
  left join tango.articulos_specs_raw sp on sp.cod_articulo = p.product_source_id
  left join lateral (
    select mm.percent
    from public.margins mm
    where mm.active and mm.customer_id is null
      and (
        (mm.scope = 'product' and mm.cod_articulo = p.product_source_id)
        or (
          mm.scope = 'category'
          and mm.category is not null
          and mm.category = coalesce(nullif(btrim(ar.familia), ''), sp.categoria)
        )
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
