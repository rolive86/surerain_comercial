-- SURE RAIN COMMERCIAL DB — 0039 dashboard comercial performance
-- Reescribe RPCs sobre sales_history (+ exclusiones) sin join pesado a v_ventas.
-- Una sola pasada bundle: dashboard_comercial. SECURITY INVOKER.

create index if not exists sh_fecha_empresa_idx
  on public.sales_history (fecha, empresa);

create or replace function public._dash_venta(
  p_moneda text,
  p_tipo text,
  p_total numeric,
  p_precio_usd numeric,
  p_cantidad numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when upper(btrim(coalesce(p_moneda, 'ARS'))) = 'USD' then
      public.sales_line_signed_total(
        p_tipo,
        coalesce(p_precio_usd, 0) * coalesce(p_cantidad, 0)
      )
    else
      public.sales_line_signed_total(p_tipo, p_total)
  end;
$$;

-- Base filtrada: fecha + empresa + exclusiones (+ familia/vendedor opcionales)
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
set statement_timeout = '25s'
as $$
declare
  v_fecha date := coalesce(p_fecha, current_date);
  v_moneda text := upper(btrim(coalesce(p_moneda, 'ARS')));
  v_alt text := case when v_moneda = 'USD' then 'ARS' else 'USD' end;
  v_anio int := extract(year from v_fecha)::int;
  v_mes int := extract(month from v_fecha)::int;
  v_desde date := make_date(v_anio, 1, 1);
  v_mes_ini date := make_date(v_anio, v_mes, 1);
  v_mes_fin date := (v_mes_ini + interval '1 month')::date;
  v_dia numeric; v_mes_tot numeric; v_anio_tot numeric;
  v_dia_alt numeric; v_mes_alt numeric; v_anio_alt numeric;
begin
  if v_moneda not in ('ARS', 'USD') then
    raise exception 'dashboard_kpis: p_moneda inválida (%)', p_moneda;
  end if;

  select
    coalesce(sum(public._dash_venta(v_moneda, sh.tipo_comprobante, sh.total_facturado, sh.precio_unitario_usd, sh.cantidad))
      filter (where sh.fecha = v_fecha), 0),
    coalesce(sum(public._dash_venta(v_moneda, sh.tipo_comprobante, sh.total_facturado, sh.precio_unitario_usd, sh.cantidad))
      filter (where sh.fecha >= v_mes_ini and sh.fecha < v_mes_fin), 0),
    coalesce(sum(public._dash_venta(v_moneda, sh.tipo_comprobante, sh.total_facturado, sh.precio_unitario_usd, sh.cantidad)), 0),
    coalesce(sum(public._dash_venta(v_alt, sh.tipo_comprobante, sh.total_facturado, sh.precio_unitario_usd, sh.cantidad))
      filter (where sh.fecha = v_fecha), 0),
    coalesce(sum(public._dash_venta(v_alt, sh.tipo_comprobante, sh.total_facturado, sh.precio_unitario_usd, sh.cantidad))
      filter (where sh.fecha >= v_mes_ini and sh.fecha < v_mes_fin), 0),
    coalesce(sum(public._dash_venta(v_alt, sh.tipo_comprobante, sh.total_facturado, sh.precio_unitario_usd, sh.cantidad)), 0)
  into v_dia, v_mes_tot, v_anio_tot, v_dia_alt, v_mes_alt, v_anio_alt
  from public.sales_history sh
  left join public.products_tango pt
    on pt.cod_articulo = sh.cod_articulo and sh.empresa = '3'
    and p_familia is not null and btrim(p_familia) <> ''
  where sh.fecha >= v_desde
    and sh.fecha <= v_fecha
    and public._dash_emp_ok(p_empresa, sh.empresa)
    and not exists (
      select 1 from public.sales_exclusiones x where x.cod_articulo = sh.cod_articulo
    )
    and (p_vendedor is null or btrim(p_vendedor) = '' or sh.cod_vendedor = p_vendedor)
    and (
      p_familia is null or btrim(p_familia) = ''
      or coalesce(nullif(btrim(pt.familia), ''), 'Sin familia') = p_familia
    );

  return jsonb_build_object(
    'fecha', v_fecha,
    'empresa', coalesce(nullif(btrim(p_empresa), ''), 'todas'),
    'moneda', v_moneda,
    'moneda_alt', v_alt,
    'venta_dia', round(v_dia),
    'venta_mes', round(v_mes_tot),
    'venta_anio', round(v_anio_tot),
    'venta_dia_alt', round(v_dia_alt),
    'venta_mes_alt', round(v_mes_alt),
    'venta_anio_alt', round(v_anio_alt),
    'anio', v_anio,
    'mes', v_mes
  );
end;
$$;

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
set statement_timeout = '25s'
as $$
declare
  v_moneda text := upper(btrim(coalesce(p_moneda, 'ARS')));
  v_result jsonb;
begin
  if v_moneda not in ('ARS', 'USD') then
    raise exception 'dashboard_matriz: p_moneda inválida (%)', p_moneda;
  end if;

  with base as (
    select
      extract(year from sh.fecha)::int as anio,
      extract(month from sh.fecha)::int as mes,
      sum(public._dash_venta(
        v_moneda, sh.tipo_comprobante, sh.total_facturado,
        sh.precio_unitario_usd, sh.cantidad
      )) as venta
    from public.sales_history sh
    left join public.products_tango pt
      on pt.cod_articulo = sh.cod_articulo and sh.empresa = '3'
      and p_familia is not null and btrim(p_familia) <> ''
    where sh.fecha >= date '2022-01-01'
      and sh.fecha < date '2027-01-01'
      and public._dash_emp_ok(p_empresa, sh.empresa)
      and not exists (
        select 1 from public.sales_exclusiones x where x.cod_articulo = sh.cod_articulo
      )
      and (p_vendedor is null or btrim(p_vendedor) = '' or sh.cod_vendedor = p_vendedor)
      and (
        p_familia is null or btrim(p_familia) = ''
        or coalesce(nullif(btrim(pt.familia), ''), 'Sin familia') = p_familia
      )
    group by 1, 2
  ),
  meses as (select m from generate_series(1, 12) m),
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
          '2022', round(y2022), '2023', round(y2023), '2024', round(y2024),
          '2025', round(y2025), '2026', round(y2026)
        ),
        'delta_mes_pct', delta_mes_pct,
        'delta_acum_pct', delta_acum_pct
      ) order by mes
    ) as rows_json
    from with_delta
  ),
  tot as (
    select
      round(sum(y2022)) as y2022, round(sum(y2023)) as y2023,
      round(sum(y2024)) as y2024, round(sum(y2025)) as y2025,
      round(sum(y2026)) as y2026
    from with_delta
  )
  select jsonb_build_object(
    'empresa', coalesce(nullif(btrim(p_empresa), ''), 'todas'),
    'moneda', v_moneda,
    'anios', jsonb_build_array(2022, 2023, 2024, 2025, 2026),
    'anio_ref', 2026,
    'anio_prev', 2025,
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
      ) from tot
    )
  ) into v_result;

  return v_result;
end;
$$;

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
set statement_timeout = '25s'
as $$
declare
  v_fecha date := coalesce(p_fecha, current_date);
  v_moneda text := upper(btrim(coalesce(p_moneda, 'ARS')));
  v_anio int := extract(year from v_fecha)::int;
  v_mes int := extract(month from v_fecha)::int;
  v_desde date := make_date(v_anio, 1, 1);
  v_mes_ini date := make_date(v_anio, v_mes, 1);
  v_mes_fin date := (v_mes_ini + interval '1 month')::date;
begin
  if v_moneda not in ('ARS', 'USD') then
    raise exception 'dashboard_ranking: p_moneda inválida (%)', p_moneda;
  end if;

  return (
    with lines as (
      select
        sh.empresa,
        sh.cod_vendedor,
        sh.fecha,
        public._dash_venta(
          v_moneda, sh.tipo_comprobante, sh.total_facturado,
          sh.precio_unitario_usd, sh.cantidad
        ) as venta
      from public.sales_history sh
      left join public.products_tango pt
        on pt.cod_articulo = sh.cod_articulo and sh.empresa = '3'
        and p_familia is not null and btrim(p_familia) <> ''
      where sh.fecha >= v_desde
        and sh.fecha <= v_fecha
        and public._dash_emp_ok(p_empresa, sh.empresa)
        and not exists (
          select 1 from public.sales_exclusiones x where x.cod_articulo = sh.cod_articulo
        )
        and (
          p_familia is null or btrim(p_familia) = ''
          or coalesce(nullif(btrim(pt.familia), ''), 'Sin familia') = p_familia
        )
    ),
    agg as (
      select
        l.cod_vendedor,
        coalesce(
          nullif(btrim(max(sr.name) filter (where l.empresa = '3')), ''),
          l.cod_vendedor,
          'Sin vendedor'
        ) as vendedor,
        coalesce(sum(l.venta) filter (
          where l.fecha >= v_mes_ini and l.fecha < v_mes_fin
        ), 0) as venta_mes,
        coalesce(sum(l.venta), 0) as venta_anio
      from lines l
      left join public.sales_reps sr
        on sr.tango_sales_rep_id = l.cod_vendedor
      group by l.cod_vendedor
    ),
    totals as (
      select coalesce(sum(venta_mes), 0) as tot_mes, coalesce(sum(venta_anio), 0) as tot_anio
      from agg
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'cod_vendedor', a.cod_vendedor,
        'vendedor', a.vendedor,
        'venta_mes', round(a.venta_mes),
        'venta_anio', round(a.venta_anio),
        'pct_mes', case when t.tot_mes = 0 then 0 else round((a.venta_mes / t.tot_mes) * 100, 1) end,
        'pct_anio', case when t.tot_anio = 0 then 0 else round((a.venta_anio / t.tot_anio) * 100, 1) end
      )
      order by case when lower(btrim(coalesce(p_periodo, 'mes'))) = 'anio'
        then a.venta_anio else a.venta_mes end desc
    ), '[]'::jsonb)
    from agg a
    cross join totals t
    where a.venta_mes <> 0 or a.venta_anio <> 0
  );
end;
$$;

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
set statement_timeout = '25s'
as $$
declare
  v_fecha date := coalesce(p_fecha, current_date);
  v_moneda text := upper(btrim(coalesce(p_moneda, 'ARS')));
  v_anio int := extract(year from v_fecha)::int;
  v_mes int := extract(month from v_fecha)::int;
  v_desde date := make_date(v_anio, 1, 1);
  v_mes_ini date := make_date(v_anio, v_mes, 1);
  v_mes_fin date := (v_mes_ini + interval '1 month')::date;
begin
  if v_moneda not in ('ARS', 'USD') then
    raise exception 'dashboard_por_empresa: p_moneda inválida (%)', p_moneda;
  end if;

  return (
    with agg as (
      select
        sh.empresa,
        case sh.empresa when '3' then 'Sure Rain' when '5' then 'Angus' else sh.empresa end as nombre,
        coalesce(sum(public._dash_venta(v_moneda, sh.tipo_comprobante, sh.total_facturado, sh.precio_unitario_usd, sh.cantidad))
          filter (where sh.fecha = v_fecha), 0) as venta_dia,
        coalesce(sum(public._dash_venta(v_moneda, sh.tipo_comprobante, sh.total_facturado, sh.precio_unitario_usd, sh.cantidad))
          filter (where sh.fecha >= v_mes_ini and sh.fecha < v_mes_fin), 0) as venta_mes,
        coalesce(sum(public._dash_venta(v_moneda, sh.tipo_comprobante, sh.total_facturado, sh.precio_unitario_usd, sh.cantidad)), 0) as venta_anio
      from public.sales_history sh
      left join public.products_tango pt
        on pt.cod_articulo = sh.cod_articulo and sh.empresa = '3'
        and p_familia is not null and btrim(p_familia) <> ''
      where sh.fecha >= v_desde
        and sh.fecha <= v_fecha
        and sh.empresa in ('3', '5')
        and not exists (
          select 1 from public.sales_exclusiones x where x.cod_articulo = sh.cod_articulo
        )
        and (p_vendedor is null or btrim(p_vendedor) = '' or sh.cod_vendedor = p_vendedor)
        and (
          p_familia is null or btrim(p_familia) = ''
          or coalesce(nullif(btrim(pt.familia), ''), 'Sin familia') = p_familia
        )
      group by sh.empresa
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
      ) order by a.empresa
    ), '[]'::jsonb)
    from agg a
    cross join totals t
  );
end;
$$;

create or replace function public.dashboard_dimensiones(
  p_empresa text default 'todas'
)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
set statement_timeout = '15s'
as $$
  select jsonb_build_object(
    'vendedores', coalesce((
      select jsonb_agg(
        jsonb_build_object('cod_vendedor', z.cod_vendedor, 'vendedor', z.vendedor)
        order by z.vendedor
      )
      from (
        select distinct on (sh.cod_vendedor)
          sh.cod_vendedor,
          coalesce(nullif(btrim(sr.name), ''), sh.cod_vendedor) as vendedor
        from public.sales_history sh
        left join public.sales_reps sr
          on sr.tango_sales_rep_id = sh.cod_vendedor
          and sh.empresa = '3'
        where public._dash_emp_ok(p_empresa, sh.empresa)
          and sh.cod_vendedor is not null
          and sh.cod_vendedor <> ''
          and sh.fecha >= date '2022-01-01'
        order by sh.cod_vendedor, (sr.name is not null) desc
      ) z
    ), '[]'::jsonb),
    'familias', coalesce((
      select jsonb_agg(f order by f)
      from (
        select distinct coalesce(nullif(btrim(pt.familia), ''), 'Sin familia') as f
        from public.products_tango pt
        where exists (
          select 1 from public.sales_history sh
          where sh.cod_articulo = pt.cod_articulo
            and sh.empresa = '3'
            and public._dash_emp_ok(p_empresa, sh.empresa)
        )
        union
        select 'Sin familia'
        where public._dash_emp_ok(p_empresa, '5')
           or public._dash_emp_ok(p_empresa, '3')
      ) y
    ), '[]'::jsonb)
  );
$$;

-- Bundle: una sola llamada HTTP para el tablero
create or replace function public.dashboard_comercial(
  p_empresa text default 'todas',
  p_moneda text default 'ARS',
  p_fecha date default current_date,
  p_vendedor text default null,
  p_familia text default null,
  p_periodo text default 'mes'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
set statement_timeout = '30s'
as $$
begin
  return jsonb_build_object(
    'kpis', public.dashboard_kpis(p_empresa, p_moneda, p_fecha, p_vendedor, p_familia),
    'matriz', public.dashboard_matriz(p_empresa, p_moneda, p_vendedor, p_familia),
    'ranking', public.dashboard_ranking(p_empresa, p_periodo, p_fecha, p_moneda, p_familia),
    'empresas', public.dashboard_por_empresa(p_fecha, p_moneda, p_vendedor, p_familia),
    'dimensiones', public.dashboard_dimensiones(p_empresa)
  );
end;
$$;

revoke all on function public.dashboard_comercial(text, text, date, text, text, text) from public, anon;
grant execute on function public.dashboard_comercial(text, text, date, text, text, text) to authenticated;

-- Re-grant after replace
revoke all on function public.dashboard_kpis(text, text, date, text, text) from public, anon;
grant execute on function public.dashboard_kpis(text, text, date, text, text) to authenticated;
revoke all on function public.dashboard_matriz(text, text, text, text) from public, anon;
grant execute on function public.dashboard_matriz(text, text, text, text) to authenticated;
revoke all on function public.dashboard_ranking(text, text, date, text, text) from public, anon;
grant execute on function public.dashboard_ranking(text, text, date, text, text) to authenticated;
revoke all on function public.dashboard_por_empresa(date, text, text, text) from public, anon;
grant execute on function public.dashboard_por_empresa(date, text, text, text) to authenticated;
revoke all on function public.dashboard_dimensiones(text) from public, anon;
grant execute on function public.dashboard_dimensiones(text) to authenticated;
