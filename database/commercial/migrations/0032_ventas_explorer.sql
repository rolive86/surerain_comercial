-- SURE RAIN COMMERCIAL DB — 0032 ventas explorer (cruces dinámicos)
-- Extiende v_sales_enriched (+ nro_comprobante al final) y crea ventas_explorer.
-- Nota: zona/city ya se pobló en 0031 + espejo:normalize.

drop view if exists public.v_sales_enriched cascade;

create view public.v_sales_enriched
with (security_invoker = true) as
select
  sh.customer_id,
  sh.cod_cliente,
  c.legal_name as cliente,
  c.city as localidad,
  c.province as provincia,
  c.phone as telefono,
  sh.cod_vendedor,
  sh.cod_articulo,
  pt.descripcion,
  pt.familia,
  sh.fecha,
  extract(year from sh.fecha)::int as anio,
  extract(month from sh.fecha)::int as mes,
  sh.cantidad,
  sh.total_facturado,
  sh.tipo_comprobante,
  public.sales_line_signed_qty(sh.tipo_comprobante, sh.cantidad) as cantidad_signed,
  public.sales_line_signed_total(sh.tipo_comprobante, sh.total_facturado) as total_signed,
  sh.nro_comprobante
from public.sales_history sh
left join public.customers c on c.id = sh.customer_id
left join public.products_tango pt on pt.cod_articulo = sh.cod_articulo;

grant select on public.v_sales_enriched to authenticated;

-- Re-crear funciones de 0031 que cayeron con CASCADE (misma definición).
create or replace function public.clientes_a_recontactar(
  p_familia text default null,
  p_cod_articulo text default null,
  p_mes_desde int default 1,
  p_mes_hasta int default 12,
  p_anio_base int default (extract(year from now())::int - 1),
  p_localidad text default null,
  p_provincia text default null
)
returns table (
  customer_id uuid,
  cliente text,
  localidad text,
  provincia text,
  telefono text,
  cant_anio_base numeric,
  total_anio_base numeric,
  ultima_compra date,
  cant_anio_actual numeric
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  with base as (
    select
      v.customer_id,
      sum(v.cantidad_signed) as cant,
      sum(v.total_signed) as tot,
      max(v.fecha) as ult
    from public.v_sales_enriched v
    where v.customer_id is not null
      and v.anio = p_anio_base
      and v.mes between p_mes_desde and p_mes_hasta
      and (p_familia is null or v.familia = p_familia)
      and (p_cod_articulo is null or v.cod_articulo = p_cod_articulo)
      and (p_localidad is null or v.localidad ilike p_localidad)
      and (p_provincia is null or v.provincia ilike p_provincia)
    group by v.customer_id
    having sum(v.cantidad_signed) > 0
  ),
  actual as (
    select
      v.customer_id,
      sum(v.cantidad_signed) as cant
    from public.v_sales_enriched v
    where v.customer_id is not null
      and v.anio = p_anio_base + 1
      and v.mes between p_mes_desde and p_mes_hasta
      and (p_familia is null or v.familia = p_familia)
      and (p_cod_articulo is null or v.cod_articulo = p_cod_articulo)
    group by v.customer_id
  )
  select
    b.customer_id,
    c.legal_name,
    c.city,
    c.province,
    c.phone,
    b.cant,
    b.tot,
    b.ult,
    coalesce(a.cant, 0)
  from base b
  join public.customers c on c.id = b.customer_id
  left join actual a on a.customer_id = b.customer_id
  where coalesce(a.cant, 0) < b.cant
  order by b.tot desc;
$fn$;

revoke all on function public.clientes_a_recontactar(text, text, int, int, int, text, text) from public, anon;
grant execute on function public.clientes_a_recontactar(text, text, int, int, int, text, text) to authenticated;

create or replace function public.cliente_comparativo_periodo(
  p_customer_id uuid,
  p_mes_desde int default 1,
  p_mes_hasta int default 12,
  p_anio_base int default (extract(year from now())::int - 1)
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
  with base as (
    select
      v.cod_articulo,
      max(v.descripcion) as descripcion,
      max(v.familia) as familia,
      sum(v.cantidad_signed) as cant,
      sum(v.total_signed) as tot
    from public.v_sales_enriched v
    where v.customer_id = p_customer_id
      and v.anio = p_anio_base
      and v.mes between p_mes_desde and p_mes_hasta
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
    where v.customer_id = p_customer_id
      and v.anio = p_anio_base + 1
      and v.mes between p_mes_desde and p_mes_hasta
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

revoke all on function public.cliente_comparativo_periodo(uuid, int, int, int) from public, anon;
grant execute on function public.cliente_comparativo_periodo(uuid, int, int, int) to authenticated;

create or replace function public.ranking_zona_familia(
  p_mes_desde int default 1,
  p_mes_hasta int default 12,
  p_anio_base int default (extract(year from now())::int - 1),
  p_agrupar_por text default 'localidad'
)
returns table (
  zona text,
  familia text,
  cant_anio_base numeric,
  total_anio_base numeric,
  cant_anio_actual numeric,
  total_anio_actual numeric
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  with base as (
    select
      case
        when lower(coalesce(p_agrupar_por, 'localidad')) = 'provincia'
        then coalesce(nullif(btrim(v.provincia), ''), 'Sin provincia')
        else coalesce(nullif(btrim(v.localidad), ''), 'Sin localidad')
      end as zona,
      coalesce(nullif(btrim(v.familia), ''), 'Sin familia') as familia,
      sum(v.cantidad_signed) as cant,
      sum(v.total_signed) as tot
    from public.v_sales_enriched v
    where v.customer_id is not null
      and v.anio = p_anio_base
      and v.mes between p_mes_desde and p_mes_hasta
    group by 1, 2
  ),
  actual as (
    select
      case
        when lower(coalesce(p_agrupar_por, 'localidad')) = 'provincia'
        then coalesce(nullif(btrim(v.provincia), ''), 'Sin provincia')
        else coalesce(nullif(btrim(v.localidad), ''), 'Sin localidad')
      end as zona,
      coalesce(nullif(btrim(v.familia), ''), 'Sin familia') as familia,
      sum(v.cantidad_signed) as cant,
      sum(v.total_signed) as tot
    from public.v_sales_enriched v
    where v.customer_id is not null
      and v.anio = p_anio_base + 1
      and v.mes between p_mes_desde and p_mes_hasta
    group by 1, 2
  ),
  keys as (
    select zona, familia from base
    union
    select zona, familia from actual
  )
  select
    k.zona,
    k.familia,
    coalesce(b.cant, 0),
    coalesce(b.tot, 0),
    coalesce(a.cant, 0),
    coalesce(a.tot, 0)
  from keys k
  left join base b on b.zona = k.zona and b.familia = k.familia
  left join actual a on a.zona = k.zona and a.familia = k.familia
  order by coalesce(b.tot, 0) desc
  limit 100;
$fn$;

revoke all on function public.ranking_zona_familia(int, int, int, text) from public, anon;
grant execute on function public.ranking_zona_familia(int, int, int, text) to authenticated;

create or replace function public.ventas_explorer(
  p_group_by text,
  p_metric text,
  p_fecha_desde date default null,
  p_fecha_hasta date default null,
  p_familia text default null,
  p_cod_articulo text default null,
  p_localidad text default null,
  p_provincia text default null,
  p_comparar_interanual boolean default false
)
returns table (
  dimension text,
  valor numeric,
  valor_anio_anterior numeric,
  variacion_pct numeric
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_dim text;
  v_metric_sql text;
  v_desde date;
  v_hasta date;
  v_desde_prev date;
  v_hasta_prev date;
  v_sql text;
begin
  v_dim := case lower(btrim(coalesce(p_group_by, '')))
    when 'cliente' then 'coalesce(nullif(btrim(cliente), ''''), ''Sin cliente'')'
    when 'localidad' then 'coalesce(nullif(btrim(localidad), ''''), ''Sin localidad'')'
    when 'provincia' then 'coalesce(nullif(btrim(provincia), ''''), ''Sin provincia'')'
    when 'familia' then 'coalesce(nullif(btrim(familia), ''''), ''Sin familia'')'
    when 'producto' then 'coalesce(nullif(btrim(cod_articulo), ''''), ''Sin código'') || coalesce('' — '' || nullif(btrim(descripcion), ''''), '''')'
    when 'vendedor' then 'coalesce(nullif(btrim(cod_vendedor), ''''), ''Sin vendedor'')'
    when 'mes' then 'lpad(mes::text, 2, ''0'') || ''-'' || anio::text'
    when 'anio' then 'anio::text'
    else null
  end;

  if v_dim is null then
    raise exception 'ventas_explorer: p_group_by inválido (%)', p_group_by;
  end if;

  v_metric_sql := case lower(btrim(coalesce(p_metric, '')))
    when 'cantidad' then 'coalesce(sum(cantidad_signed), 0)'
    when 'facturacion' then 'coalesce(sum(total_signed), 0)'
    when 'comprobantes' then 'count(distinct nullif(btrim(nro_comprobante), ''''))'
    when 'clientes' then 'count(distinct customer_id)'
    else null
  end;

  if v_metric_sql is null then
    raise exception 'ventas_explorer: p_metric inválido (%)', p_metric;
  end if;

  v_desde := coalesce(p_fecha_desde, date_trunc('year', current_date)::date);
  v_hasta := coalesce(p_fecha_hasta, current_date);
  if v_hasta < v_desde then
    raise exception 'ventas_explorer: p_fecha_hasta < p_fecha_desde';
  end if;

  v_desde_prev := (v_desde - interval '1 year')::date;
  v_hasta_prev := (v_hasta - interval '1 year')::date;

  if coalesce(p_comparar_interanual, false) then
    v_sql := format(
      $q$
      with cur as (
        select %s as dimension, %s as valor
        from public.v_sales_enriched
        where fecha is not null
          and fecha between $1 and $2
          and ($3::text is null or familia = $3)
          and ($4::text is null or cod_articulo = $4)
          and ($5::text is null or localidad ilike $5)
          and ($6::text is null or provincia ilike $6)
        group by 1
      ),
      prev as (
        select %s as dimension, %s as valor
        from public.v_sales_enriched
        where fecha is not null
          and fecha between $7 and $8
          and ($3::text is null or familia = $3)
          and ($4::text is null or cod_articulo = $4)
          and ($5::text is null or localidad ilike $5)
          and ($6::text is null or provincia ilike $6)
        group by 1
      ),
      keys as (
        select dimension from cur
        union
        select dimension from prev
      )
      select
        k.dimension,
        coalesce(c.valor, 0)::numeric as valor,
        coalesce(p.valor, 0)::numeric as valor_anio_anterior,
        case
          when coalesce(p.valor, 0) = 0 and coalesce(c.valor, 0) = 0 then 0::numeric
          when coalesce(p.valor, 0) = 0 then null::numeric
          else round(((coalesce(c.valor, 0) - p.valor) / abs(p.valor)) * 100, 1)
        end as variacion_pct
      from keys k
      left join cur c on c.dimension = k.dimension
      left join prev p on p.dimension = k.dimension
      order by coalesce(c.valor, 0) desc
      limit 200
      $q$,
      v_dim, v_metric_sql, v_dim, v_metric_sql
    );

    return query execute v_sql
      using v_desde, v_hasta, p_familia, p_cod_articulo, p_localidad, p_provincia,
            v_desde_prev, v_hasta_prev;
  else
    v_sql := format(
      $q$
      select
        %s as dimension,
        %s as valor,
        null::numeric as valor_anio_anterior,
        null::numeric as variacion_pct
      from public.v_sales_enriched
      where fecha is not null
        and fecha between $1 and $2
        and ($3::text is null or familia = $3)
        and ($4::text is null or cod_articulo = $4)
        and ($5::text is null or localidad ilike $5)
        and ($6::text is null or provincia ilike $6)
      group by 1
      order by 2 desc
      limit 200
      $q$,
      v_dim, v_metric_sql
    );

    return query execute v_sql
      using v_desde, v_hasta, p_familia, p_cod_articulo, p_localidad, p_provincia;
  end if;
end;
$fn$;

revoke all on function public.ventas_explorer(text, text, date, date, text, text, text, text, boolean)
  from public, anon;
grant execute on function public.ventas_explorer(text, text, date, date, text, text, text, text, boolean)
  to authenticated;
