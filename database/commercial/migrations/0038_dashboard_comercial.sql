-- SURE RAIN COMMERCIAL DB — 0038 dashboard comercial BI (v_ventas)
-- SECURITY INVOKER → RLS de sales_history aplica vía v_ventas.
-- Empresa: '3' | '5' | 'todas'. Moneda: 'ARS' | 'USD'.

create or replace function public._dash_emp_ok(p_empresa text, p_row_empresa text)
returns boolean
language sql
immutable
as $$
  select case
    when p_empresa is null or btrim(p_empresa) = '' or lower(btrim(p_empresa)) = 'todas'
      then true
    else p_row_empresa = btrim(p_empresa)
  end;
$$;

create or replace function public._dash_measure(p_moneda text, p_ars numeric, p_usd numeric)
returns numeric
language sql
immutable
as $$
  select case
    when upper(btrim(coalesce(p_moneda, 'ARS'))) = 'USD' then coalesce(p_usd, 0)
    else coalesce(p_ars, 0)
  end;
$$;

-- ── KPIs día / mes / año ─────────────────────────────────────────────────────
create or replace function public.dashboard_kpis(
  p_empresa text default 'todas',
  p_moneda text default 'ARS',
  p_fecha date default current_date,
  p_vendedor text default null,
  p_familia text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_fecha date := coalesce(p_fecha, current_date);
  v_moneda text := upper(btrim(coalesce(p_moneda, 'ARS')));
  v_alt text := case when v_moneda = 'USD' then 'ARS' else 'USD' end;
  v_dia numeric;
  v_mes numeric;
  v_anio numeric;
  v_dia_alt numeric;
  v_mes_alt numeric;
  v_anio_alt numeric;
begin
  if v_moneda not in ('ARS', 'USD') then
    raise exception 'dashboard_kpis: p_moneda inválida (%)', p_moneda;
  end if;

  select
    coalesce(sum(public._dash_measure(v_moneda, v.venta_ars, v.venta_usd))
      filter (where v.fecha = v_fecha), 0),
    coalesce(sum(public._dash_measure(v_moneda, v.venta_ars, v.venta_usd))
      filter (
        where v.anio = extract(year from v_fecha)::int
          and v.mes = extract(month from v_fecha)::int
      ), 0),
    coalesce(sum(public._dash_measure(v_moneda, v.venta_ars, v.venta_usd))
      filter (
        where v.anio = extract(year from v_fecha)::int
          and v.mes <= extract(month from v_fecha)::int
      ), 0),
    coalesce(sum(public._dash_measure(v_alt, v.venta_ars, v.venta_usd))
      filter (where v.fecha = v_fecha), 0),
    coalesce(sum(public._dash_measure(v_alt, v.venta_ars, v.venta_usd))
      filter (
        where v.anio = extract(year from v_fecha)::int
          and v.mes = extract(month from v_fecha)::int
      ), 0),
    coalesce(sum(public._dash_measure(v_alt, v.venta_ars, v.venta_usd))
      filter (
        where v.anio = extract(year from v_fecha)::int
          and v.mes <= extract(month from v_fecha)::int
      ), 0)
  into v_dia, v_mes, v_anio, v_dia_alt, v_mes_alt, v_anio_alt
  from public.v_ventas v
  where public._dash_emp_ok(p_empresa, v.empresa)
    and (p_vendedor is null or btrim(p_vendedor) = '' or v.cod_vendedor = p_vendedor)
    and (p_familia is null or btrim(p_familia) = '' or v.familia = p_familia);

  return jsonb_build_object(
    'fecha', v_fecha,
    'empresa', coalesce(nullif(btrim(p_empresa), ''), 'todas'),
    'moneda', v_moneda,
    'moneda_alt', v_alt,
    'venta_dia', round(v_dia),
    'venta_mes', round(v_mes),
    'venta_anio', round(v_anio),
    'venta_dia_alt', round(v_dia_alt),
    'venta_mes_alt', round(v_mes_alt),
    'venta_anio_alt', round(v_anio_alt),
    'anio', extract(year from v_fecha)::int,
    'mes', extract(month from v_fecha)::int
  );
end;
$$;

revoke all on function public.dashboard_kpis(text, text, date, text, text) from public, anon;
grant execute on function public.dashboard_kpis(text, text, date, text, text) to authenticated;

-- ── Matriz mes × año + Δ ─────────────────────────────────────────────────────
create or replace function public.dashboard_matriz(
  p_empresa text default 'todas',
  p_moneda text default 'ARS',
  p_vendedor text default null,
  p_familia text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_moneda text := upper(btrim(coalesce(p_moneda, 'ARS')));
  v_anio_cur int := 2026;
  v_anio_prev int := 2025;
  v_result jsonb;
begin
  if v_moneda not in ('ARS', 'USD') then
    raise exception 'dashboard_matriz: p_moneda inválida (%)', p_moneda;
  end if;

  with base as (
    select
      v.anio,
      v.mes,
      sum(public._dash_measure(v_moneda, v.venta_ars, v.venta_usd)) as venta
    from public.v_ventas v
    where v.anio between 2022 and 2026
      and public._dash_emp_ok(p_empresa, v.empresa)
      and (p_vendedor is null or btrim(p_vendedor) = '' or v.cod_vendedor = p_vendedor)
      and (p_familia is null or btrim(p_familia) = '' or v.familia = p_familia)
    group by v.anio, v.mes
  ),
  meses as (
    select m from generate_series(1, 12) m
  ),
  pivot as (
    select
      m.m as mes,
      coalesce(sum(b.venta) filter (where b.anio = 2022), 0) as y2022,
      coalesce(sum(b.venta) filter (where b.anio = 2023), 0) as y2023,
      coalesce(sum(b.venta) filter (where b.anio = 2024), 0) as y2024,
      coalesce(sum(b.venta) filter (where b.anio = 2025), 0) as y2025,
      coalesce(sum(b.venta) filter (where b.anio = 2026), 0) as y2026
    from meses m
    left join base b on b.mes = m.m
    group by m.m
  ),
  with_delta as (
    select
      p.*,
      case
        when abs(p.y2025) < 0.005 and abs(p.y2026) < 0.005 then 0::numeric
        when abs(p.y2025) < 0.005 then null::numeric
        else round(((p.y2026 - p.y2025) / abs(p.y2025)) * 100, 1)
      end as delta_mes_pct,
      case
        when abs(sum(p.y2025) over (order by p.mes)) < 0.005
          and abs(sum(p.y2026) over (order by p.mes)) < 0.005 then 0::numeric
        when abs(sum(p.y2025) over (order by p.mes)) < 0.005 then null::numeric
        else round((
          (sum(p.y2026) over (order by p.mes) - sum(p.y2025) over (order by p.mes))
          / abs(sum(p.y2025) over (order by p.mes))
        ) * 100, 1)
      end as delta_acum_pct
    from pivot p
  ),
  filas as (
    select jsonb_agg(
      jsonb_build_object(
        'mes', mes,
        'valores', jsonb_build_object(
          '2022', round(y2022),
          '2023', round(y2023),
          '2024', round(y2024),
          '2025', round(y2025),
          '2026', round(y2026)
        ),
        'delta_mes_pct', delta_mes_pct,
        'delta_acum_pct', delta_acum_pct
      )
      order by mes
    ) as rows_json
    from with_delta
  ),
  tot as (
    select
      round(sum(y2022)) as y2022,
      round(sum(y2023)) as y2023,
      round(sum(y2024)) as y2024,
      round(sum(y2025)) as y2025,
      round(sum(y2026)) as y2026
    from with_delta
  )
  select jsonb_build_object(
    'empresa', coalesce(nullif(btrim(p_empresa), ''), 'todas'),
    'moneda', v_moneda,
    'anios', jsonb_build_array(2022, 2023, 2024, 2025, 2026),
    'anio_ref', v_anio_cur,
    'anio_prev', v_anio_prev,
    'filas', coalesce((select rows_json from filas), '[]'::jsonb),
    'total', (
      select jsonb_build_object(
        'valores', jsonb_build_object(
          '2022', y2022, '2023', y2023, '2024', y2024, '2025', y2025, '2026', y2026
        ),
        'delta_mes_pct', case
          when abs(y2025) < 0.005 and abs(y2026) < 0.005 then 0
          when abs(y2025) < 0.005 then null
          else round(((y2026 - y2025) / abs(y2025)) * 100, 1)
        end,
        'delta_acum_pct', case
          when abs(y2025) < 0.005 and abs(y2026) < 0.005 then 0
          when abs(y2025) < 0.005 then null
          else round(((y2026 - y2025) / abs(y2025)) * 100, 1)
        end
      )
      from tot
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.dashboard_matriz(text, text, text, text) from public, anon;
grant execute on function public.dashboard_matriz(text, text, text, text) to authenticated;

-- ── Ranking vendedores ───────────────────────────────────────────────────────
create or replace function public.dashboard_ranking(
  p_empresa text default 'todas',
  p_periodo text default 'mes',
  p_fecha date default current_date,
  p_moneda text default 'ARS',
  p_familia text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_fecha date := coalesce(p_fecha, current_date);
  v_moneda text := upper(btrim(coalesce(p_moneda, 'ARS')));
  v_anio int := extract(year from v_fecha)::int;
  v_mes int := extract(month from v_fecha)::int;
begin
  if v_moneda not in ('ARS', 'USD') then
    raise exception 'dashboard_ranking: p_moneda inválida (%)', p_moneda;
  end if;

  return (
    with agg as (
      select
        v.cod_vendedor,
        coalesce(nullif(btrim(v.vendedor), ''), v.cod_vendedor, 'Sin vendedor') as vendedor,
        coalesce(sum(public._dash_measure(v_moneda, v.venta_ars, v.venta_usd))
          filter (where v.anio = v_anio and v.mes = v_mes), 0) as venta_mes,
        coalesce(sum(public._dash_measure(v_moneda, v.venta_ars, v.venta_usd))
          filter (where v.anio = v_anio and v.mes <= v_mes), 0) as venta_anio
      from public.v_ventas v
      where public._dash_emp_ok(p_empresa, v.empresa)
        and v.anio = v_anio
        and v.mes <= v_mes
        and (p_familia is null or btrim(p_familia) = '' or v.familia = p_familia)
      group by v.cod_vendedor, coalesce(nullif(btrim(v.vendedor), ''), v.cod_vendedor, 'Sin vendedor')
    ),
    totals as (
      select
        coalesce(sum(venta_mes), 0) as tot_mes,
        coalesce(sum(venta_anio), 0) as tot_anio
      from agg
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'cod_vendedor', a.cod_vendedor,
        'vendedor', a.vendedor,
        'venta_mes', round(a.venta_mes),
        'venta_anio', round(a.venta_anio),
        'pct_mes', case
          when t.tot_mes = 0 then 0
          else round((a.venta_mes / t.tot_mes) * 100, 1)
        end,
        'pct_anio', case
          when t.tot_anio = 0 then 0
          else round((a.venta_anio / t.tot_anio) * 100, 1)
        end
      )
      order by
        case when lower(btrim(coalesce(p_periodo, 'mes'))) = 'anio'
          then a.venta_anio else a.venta_mes end desc
    ), '[]'::jsonb)
    from agg a
    cross join totals t
    where a.venta_mes <> 0 or a.venta_anio <> 0
  );
end;
$$;

revoke all on function public.dashboard_ranking(text, text, date, text, text) from public, anon;
grant execute on function public.dashboard_ranking(text, text, date, text, text) to authenticated;

-- ── Tabla por empresa ────────────────────────────────────────────────────────
create or replace function public.dashboard_por_empresa(
  p_fecha date default current_date,
  p_moneda text default 'ARS',
  p_vendedor text default null,
  p_familia text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_fecha date := coalesce(p_fecha, current_date);
  v_moneda text := upper(btrim(coalesce(p_moneda, 'ARS')));
  v_anio int := extract(year from v_fecha)::int;
  v_mes int := extract(month from v_fecha)::int;
begin
  if v_moneda not in ('ARS', 'USD') then
    raise exception 'dashboard_por_empresa: p_moneda inválida (%)', p_moneda;
  end if;

  return (
    with agg as (
      select
        v.empresa,
        case v.empresa when '3' then 'Sure Rain' when '5' then 'Angus' else v.empresa end as nombre,
        coalesce(sum(public._dash_measure(v_moneda, v.venta_ars, v.venta_usd))
          filter (where v.fecha = v_fecha), 0) as venta_dia,
        coalesce(sum(public._dash_measure(v_moneda, v.venta_ars, v.venta_usd))
          filter (where v.anio = v_anio and v.mes = v_mes), 0) as venta_mes,
        coalesce(sum(public._dash_measure(v_moneda, v.venta_ars, v.venta_usd))
          filter (where v.anio = v_anio and v.mes <= v_mes), 0) as venta_anio
      from public.v_ventas v
      where v.empresa in ('3', '5')
        and (p_vendedor is null or btrim(p_vendedor) = '' or v.cod_vendedor = p_vendedor)
        and (p_familia is null or btrim(p_familia) = '' or v.familia = p_familia)
      group by v.empresa
    ),
    totals as (
      select
        coalesce(sum(venta_dia), 0) as tot_dia,
        coalesce(sum(venta_mes), 0) as tot_mes,
        coalesce(sum(venta_anio), 0) as tot_anio
      from agg
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'empresa', a.empresa,
        'nombre', a.nombre,
        'venta_dia', round(a.venta_dia),
        'venta_mes', round(a.venta_mes),
        'venta_anio', round(a.venta_anio),
        'pct_dia', case when t.tot_dia = 0 then 0 else round((a.venta_dia / t.tot_dia) * 100, 1) end,
        'pct_mes', case when t.tot_mes = 0 then 0 else round((a.venta_mes / t.tot_mes) * 100, 1) end,
        'pct_anio', case when t.tot_anio = 0 then 0 else round((a.venta_anio / t.tot_anio) * 100, 1) end
      )
      order by a.empresa
    ), '[]'::jsonb)
    from agg a
    cross join totals t
  );
end;
$$;

revoke all on function public.dashboard_por_empresa(date, text, text, text) from public, anon;
grant execute on function public.dashboard_por_empresa(date, text, text, text) to authenticated;

-- ── Dimensiones para filtros ─────────────────────────────────────────────────
create or replace function public.dashboard_dimensiones(
  p_empresa text default 'todas'
)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'vendedores', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'cod_vendedor', x.cod_vendedor,
          'vendedor', x.vendedor
        )
        order by x.vendedor
      )
      from (
        select distinct
          v.cod_vendedor,
          coalesce(nullif(btrim(v.vendedor), ''), v.cod_vendedor, 'Sin vendedor') as vendedor
        from public.v_ventas v
        where public._dash_emp_ok(p_empresa, v.empresa)
          and v.cod_vendedor is not null
          and v.cod_vendedor <> ''
      ) x
    ), '[]'::jsonb),
    'familias', coalesce((
      select jsonb_agg(f order by f)
      from (
        select distinct coalesce(nullif(btrim(v.familia), ''), 'Sin familia') as f
        from public.v_ventas v
        where public._dash_emp_ok(p_empresa, v.empresa)
      ) y
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.dashboard_dimensiones(text) from public, anon;
grant execute on function public.dashboard_dimensiones(text) to authenticated;
