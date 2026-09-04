-- SURE RAIN COMMERCIAL DB — 0031 inteligencia comercial del vendedor
-- Vista enriquecida + clientes_a_recontactar (SECURITY INVOKER → hereda RLS).

-- Provincia best-effort desde CPA (letra inicial). CP viejo 4 dígitos → null.
create or replace function public.province_from_postal_code(p_cp text)
returns text
language sql
immutable
as $$
  select case upper(left(btrim(coalesce(p_cp, '')), 1))
    when 'A' then 'Salta'
    when 'B' then 'Buenos Aires'
    when 'C' then 'CABA'
    when 'D' then 'San Luis'
    when 'E' then 'Entre Ríos'
    when 'F' then 'La Rioja'
    when 'G' then 'Santiago del Estero'
    when 'H' then 'Chaco'
    when 'J' then 'San Juan'
    when 'K' then 'Catamarca'
    when 'L' then 'La Pampa'
    when 'M' then 'Mendoza'
    when 'N' then 'Misiones'
    when 'P' then 'Formosa'
    when 'Q' then 'Neuquén'
    when 'R' then 'Río Negro'
    when 'S' then 'Santa Fe'
    when 'T' then 'Tucumán'
    when 'U' then 'Chubut'
    when 'V' then 'Tierra del Fuego'
    when 'W' then 'Corrientes'
    when 'X' then 'Córdoba'
    when 'Y' then 'Jujuy'
    when 'Z' then 'Santa Cruz'
    else null
  end
  where btrim(coalesce(p_cp, '')) ~ '^[A-Za-z]'
$$;

create or replace view public.v_sales_enriched
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
  public.sales_line_signed_total(sh.tipo_comprobante, sh.total_facturado) as total_signed
from public.sales_history sh
left join public.customers c on c.id = sh.customer_id
left join public.products_tango pt on pt.cod_articulo = sh.cod_articulo;

grant select on public.v_sales_enriched to authenticated;

-- Clientes que compraban en el período del año base y este año no (o menos).
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
as $$
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
$$;

revoke all on function public.clientes_a_recontactar(text, text, int, int, int, text, text) from public, anon;
grant execute on function public.clientes_a_recontactar(text, text, int, int, int, text, text) to authenticated;

-- Comparativo por producto de un cliente vs mismo período año anterior.
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
as $$
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
$$;

revoke all on function public.cliente_comparativo_periodo(uuid, int, int, int) from public, anon;
grant execute on function public.cliente_comparativo_periodo(uuid, int, int, int) to authenticated;

-- Ranking familia × zona con comparación interanual.
create or replace function public.ranking_zona_familia(
  p_mes_desde int default 1,
  p_mes_hasta int default 12,
  p_anio_base int default (extract(year from now())::int - 1),
  p_agrupar_por text default 'localidad'  -- 'localidad' | 'provincia'
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
as $$
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
$$;

revoke all on function public.ranking_zona_familia(int, int, int, text) from public, anon;
grant execute on function public.ranking_zona_familia(int, int, int, text) to authenticated;
