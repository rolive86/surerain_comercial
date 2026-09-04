-- Pulseada / cliente_comparativo_periodo: optional same-day YoY cutoff.
-- When p_dia_hasta is null (Inteligencia / callers legacy): full months (previous behavior).
-- When set (Pulseada): compare ene→mes_hasta up to that day-of-month in both years.

-- Drop 4-arg overload so callers resolve to the new signature (p_dia_hasta default null).
drop function if exists public.cliente_comparativo_periodo(uuid, int, int, int);

create or replace function public.cliente_comparativo_periodo(
  p_customer_id uuid,
  p_mes_desde int default 1,
  p_mes_hasta int default 12,
  p_anio_base int default (extract(year from now())::int - 1),
  p_dia_hasta int default null
)
returns table (
  cod_articulo text,
  descripcion text,
  familia text,
  cant_anio_base numeric,
  total_anio_base numeric,
  cant_anio_actual numeric,
  total_anio_actual numeric,
  estado text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  with bounds as (
    select
      make_date(p_anio_base, p_mes_desde, 1) as base_desde,
      least(
        (
          make_date(p_anio_base, p_mes_hasta, 1)
          + (coalesce(p_dia_hasta, 31) - 1) * interval '1 day'
        )::date,
        (make_date(p_anio_base, p_mes_hasta, 1) + interval '1 month' - interval '1 day')::date
      ) as base_hasta,
      make_date(p_anio_base + 1, p_mes_desde, 1) as act_desde,
      least(
        (
          make_date(p_anio_base + 1, p_mes_hasta, 1)
          + (coalesce(p_dia_hasta, 31) - 1) * interval '1 day'
        )::date,
        (make_date(p_anio_base + 1, p_mes_hasta, 1) + interval '1 month' - interval '1 day')::date
      ) as act_hasta
  ),
  base as (
    select
      v.cod_articulo,
      max(v.descripcion) as descripcion,
      max(v.familia) as familia,
      sum(v.cantidad_signed) as cant,
      sum(v.total_signed) as tot
    from public.v_sales_enriched v
    cross join bounds b
    where v.customer_id = p_customer_id
      and v.fecha >= b.base_desde
      and v.fecha <= b.base_hasta
      and v.cod_articulo is not null
    group by v.cod_articulo
  ),
  actual as (
    select
      v.cod_articulo,
      max(v.descripcion) as descripcion,
      max(v.familia) as familia,
      sum(v.cantidad_signed) as cant,
      sum(v.total_signed) as tot
    from public.v_sales_enriched v
    cross join bounds b
    where v.customer_id = p_customer_id
      and v.fecha >= b.act_desde
      and v.fecha <= b.act_hasta
      and v.cod_articulo is not null
    group by v.cod_articulo
  ),
  codes as (
    select cod_articulo from base
    union
    select cod_articulo from actual
  )
  select
    c.cod_articulo,
    coalesce(b.descripcion, a.descripcion),
    coalesce(b.familia, a.familia),
    coalesce(b.cant, 0),
    coalesce(b.tot, 0),
    coalesce(a.cant, 0),
    coalesce(a.tot, 0),
    case
      when coalesce(b.cant, 0) > 0 and coalesce(a.cant, 0) = 0 then 'dejo_de_comprar'
      when coalesce(b.cant, 0) = 0 and coalesce(a.cant, 0) > 0 then 'nuevo'
      when coalesce(a.cant, 0) < coalesce(b.cant, 0) then 'bajo'
      when coalesce(a.cant, 0) > coalesce(b.cant, 0) then 'subio'
      else 'igual'
    end
  from codes c
  left join base b on b.cod_articulo = c.cod_articulo
  left join actual a on a.cod_articulo = c.cod_articulo
  order by greatest(coalesce(b.tot, 0), coalesce(a.tot, 0)) desc;
$fn$;

revoke all on function public.cliente_comparativo_periodo(uuid, int, int, int, int) from public, anon;
grant execute on function public.cliente_comparativo_periodo(uuid, int, int, int, int) to authenticated;
