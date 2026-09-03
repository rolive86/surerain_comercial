-- SURE RAIN COMMERCIAL DB — 0042 rendicion_save: moneda + cai_cae desde OCR
create or replace function public.rendicion_save(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, rendiciones, pg_temp
as $$
declare
  v_role text := public.current_role();
  v_uid uuid := auth.uid();
  v_id uuid;
  v_concepto_id uuid;
  v_cod_concepto text;
  v_cod_sector text;
  v_total numeric;
  v_iva jsonb;
  v_item jsonb;
  v_cod_vend text;
  v_rep_id uuid;
begin
  if v_role is null
     or v_role not in ('sales_rep', 'sales_manager', 'operations', 'admin') then
    raise exception 'not allowed';
  end if;
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if nullif(btrim(coalesce(p->>'image_path', '')), '') is null then
    raise exception 'image_path required';
  end if;

  v_total := nullif(p->>'total', '')::numeric;
  v_concepto_id := nullif(p->>'concepto_id', '')::uuid;

  begin
    v_rep_id := nullif(auth.jwt() ->> 'sales_rep_id', '')::uuid;
  exception when others then
    v_rep_id := null;
  end;

  if v_rep_id is not null then
    select sr.tango_sales_rep_id into v_cod_vend
    from public.sales_reps sr
    where sr.id = v_rep_id;
  end if;

  if v_concepto_id is not null then
    select
      coalesce(nullif(c.cod_concepto, ''), c.id::text),
      cc.cod_sector
    into v_cod_concepto, v_cod_sector
    from rendiciones.conceptos c
    left join rendiciones.centros_costo cc on cc.id = c.centro_costo_id
    where c.id = v_concepto_id and c.activo;

    if v_cod_concepto is null then
      raise exception 'concepto inválido';
    end if;
  end if;

  insert into rendiciones.comprobantes (
    uploaded_by,
    cod_vendedor,
    tipo,
    image_path,
    estado,
    observaciones,
    concepto_id,
    tipo_comprobante,
    nro_comprobante,
    fecha_emision,
    fecha_contable,
    moneda,
    total,
    cuit_emisor,
    cai_cae,
    cod_sector,
    ocr_raw
  ) values (
    v_uid,
    coalesce(nullif(p->>'cod_vendedor', ''), v_cod_vend),
    coalesce(nullif(p->>'tipo', ''), 'gasto'),
    btrim(p->>'image_path'),
    coalesce(nullif(p->>'estado', ''), 'rendido'),
    nullif(p->>'observaciones', ''),
    v_concepto_id,
    nullif(p->>'tipo_comprobante', ''),
    nullif(p->>'nro_comprobante', ''),
    nullif(p->>'fecha_emision', '')::date,
    nullif(p->>'fecha_contable', '')::date,
    coalesce(nullif(p->>'moneda', ''), 'PES'),
    v_total,
    nullif(regexp_replace(coalesce(p->>'cuit_emisor', ''), '\D', '', 'g'), ''),
    nullif(p->>'cai_cae', ''),
    v_cod_sector,
    case when p ? 'ocr_raw' then p->'ocr_raw' else null end
  )
  returning id into v_id;

  if v_cod_concepto is not null then
    insert into rendiciones.comprobante_conceptos (comprobante_id, cod_concepto, importe)
    values (v_id, v_cod_concepto, v_total);
  end if;

  v_iva := coalesce(p->'iva', '[]'::jsonb);
  if jsonb_typeof(v_iva) = 'array' then
    for v_item in select * from jsonb_array_elements(v_iva)
    loop
      insert into rendiciones.comprobante_iva (comprobante_id, cod_alicuota, importe)
      values (
        v_id,
        nullif(v_item->>'cod_alicuota', ''),
        nullif(v_item->>'importe', '')::numeric
      );
    end loop;
  end if;

  return v_id;
end;
$$;

revoke all on function public.rendicion_save(jsonb) from public, anon;
grant execute on function public.rendicion_save(jsonb) to authenticated;
