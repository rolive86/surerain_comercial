-- SURE RAIN COMMERCIAL DB — 0041 rendiciones (plantilla Tango + Etapa 1)
-- Schema NO expuesto por PostgREST: acceso vía RPCs public.rendicion_*.
-- Encabezado calca la plantilla de importación (ID Comprobante → IVA / Conceptos).
-- Proveedores / códigos Tango llegan en Etapa 2 (quedan null).

create schema if not exists rendiciones;
revoke all on schema rendiciones from public, anon, authenticated;
grant usage on schema rendiciones to postgres, service_role;
grant all on schema rendiciones to postgres, service_role;
alter default privileges in schema rendiciones
  grant all on tables to postgres, service_role;
alter default privileges in schema rendiciones
  grant all on sequences to postgres, service_role;

-- ── Encabezado (1) ───────────────────────────────────────────────────────────
create table if not exists rendiciones.comprobantes (
  id uuid primary key default gen_random_uuid(),
  -- circuito / app
  uploaded_by uuid references auth.users (id),
  cod_vendedor text,
  tipo text check (tipo in ('gasto', 'venta')) default 'gasto',
  image_path text,
  estado text not null default 'rendido', -- rendido -> validado -> importado -> archivado
  observaciones text,
  created_at timestamptz not null default now(),
  -- catálogo app (Etapa 1); cod_concepto/cod_sector salen de acá hacia líneas/encabezado
  concepto_id uuid,
  -- === Encabezado plantilla Tango ===
  tipo_comprobante text,
  nro_comprobante text,
  fecha_emision date,
  fecha_contable date,
  moneda text default 'PES',
  cotizacion numeric,
  condicion_compra text,
  subtotal_gravado numeric,
  subtotal_no_gravado numeric,
  anticipo numeric,
  bonificacion numeric,
  flete numeric,
  intereses numeric,
  total numeric,
  es_factura_electronica boolean,
  cai_cae text,
  fecha_vencimiento date,
  credito_fiscal_no_computable numeric,
  -- === Resuelve Tango (Etapa 2): null por ahora ===
  cod_proveedor text,
  cod_gasto text,
  cod_sector text,
  cod_clasificador text,
  cod_tipo_operacion text,
  cod_comprobante_tango text,
  nro_sucursal text,
  -- CUIT emisor (OCR / rinde; Etapa 2 → cod_proveedor)
  cuit_emisor text,
  ocr_raw jsonb
);

create index if not exists comprobantes_uploaded_by_idx
  on rendiciones.comprobantes (uploaded_by);
create index if not exists comprobantes_created_at_idx
  on rendiciones.comprobantes (created_at desc);
create index if not exists comprobantes_estado_idx
  on rendiciones.comprobantes (estado);

-- ── IVA (N) ──────────────────────────────────────────────────────────────────
create table if not exists rendiciones.comprobante_iva (
  id uuid primary key default gen_random_uuid(),
  comprobante_id uuid not null
    references rendiciones.comprobantes (id) on delete cascade,
  cod_alicuota text,
  importe numeric
);

create index if not exists comprobante_iva_comp_idx
  on rendiciones.comprobante_iva (comprobante_id);

-- ── Conceptos (N) ────────────────────────────────────────────────────────────
create table if not exists rendiciones.comprobante_conceptos (
  id uuid primary key default gen_random_uuid(),
  comprobante_id uuid not null
    references rendiciones.comprobantes (id) on delete cascade,
  cod_concepto text,
  importe numeric
);

create index if not exists comprobante_conceptos_comp_idx
  on rendiciones.comprobante_conceptos (comprobante_id);

-- ── Catálogos editables (hasta Tango Etapa 2) ────────────────────────────────
create table if not exists rendiciones.centros_costo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cod_sector text,
  activo boolean not null default true
);

create table if not exists rendiciones.conceptos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cod_concepto text,
  centro_costo_id uuid references rendiciones.centros_costo (id),
  activo boolean not null default true
);

alter table rendiciones.comprobantes
  drop constraint if exists comprobantes_concepto_id_fkey;
alter table rendiciones.comprobantes
  add constraint comprobantes_concepto_id_fkey
  foreign key (concepto_id) references rendiciones.conceptos (id);

insert into rendiciones.centros_costo (nombre)
select 'Sin centro'
where not exists (
  select 1 from rendiciones.centros_costo where nombre = 'Sin centro'
);

insert into rendiciones.conceptos (nombre, centro_costo_id)
select m.nombre, cc.id
from (
  select nombre from public.motivos_factura where activo
  union
  select x.nombre
  from (values
    ('Combustible'),
    ('Peaje'),
    ('Viáticos'),
    ('Mercadería'),
    ('Otro')
  ) as x(nombre)
) m
cross join lateral (
  select id from rendiciones.centros_costo where nombre = 'Sin centro' limit 1
) cc
where not exists (
  select 1 from rendiciones.conceptos c where c.nombre = m.nombre
);

-- ── RLS (defensa en profundidad; clientes no tienen USAGE en el schema) ──────
alter table rendiciones.comprobantes enable row level security;
alter table rendiciones.comprobante_iva enable row level security;
alter table rendiciones.comprobante_conceptos enable row level security;
alter table rendiciones.centros_costo enable row level security;
alter table rendiciones.conceptos enable row level security;

drop policy if exists comp_own on rendiciones.comprobantes;
create policy comp_own on rendiciones.comprobantes
  for select using (
    uploaded_by = auth.uid()
    or public.current_role() in (
      'sales_manager', 'operations', 'admin'
    )
  );

drop policy if exists comp_ins on rendiciones.comprobantes;
create policy comp_ins on rendiciones.comprobantes
  for insert with check (uploaded_by = auth.uid());

drop policy if exists comp_upd on rendiciones.comprobantes;
create policy comp_upd on rendiciones.comprobantes
  for update using (
    uploaded_by = auth.uid()
    or public.current_role() in (
      'sales_manager', 'operations', 'admin'
    )
  );

drop policy if exists iva_via_comp on rendiciones.comprobante_iva;
create policy iva_via_comp on rendiciones.comprobante_iva
  for all using (
    exists (
      select 1 from rendiciones.comprobantes c
      where c.id = comprobante_id
        and (
          c.uploaded_by = auth.uid()
          or public.current_role() in (
            'sales_manager', 'operations', 'admin'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from rendiciones.comprobantes c
      where c.id = comprobante_id
        and c.uploaded_by = auth.uid()
    )
  );

drop policy if exists conceptos_via_comp on rendiciones.comprobante_conceptos;
create policy conceptos_via_comp on rendiciones.comprobante_conceptos
  for all using (
    exists (
      select 1 from rendiciones.comprobantes c
      where c.id = comprobante_id
        and (
          c.uploaded_by = auth.uid()
          or public.current_role() in (
            'sales_manager', 'operations', 'admin'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from rendiciones.comprobantes c
      where c.id = comprobante_id
        and c.uploaded_by = auth.uid()
    )
  );

drop policy if exists centros_staff_select on rendiciones.centros_costo;
create policy centros_staff_select on rendiciones.centros_costo
  for select using (
    public.current_role() in (
      'sales_rep', 'sales_manager', 'operations', 'admin'
    )
  );

drop policy if exists conceptos_staff_select on rendiciones.conceptos;
create policy conceptos_staff_select on rendiciones.conceptos
  for select using (
    public.current_role() in (
      'sales_rep', 'sales_manager', 'operations', 'admin'
    )
  );

grant all on all tables in schema rendiciones to service_role;
grant all on all sequences in schema rendiciones to service_role;

-- ── Storage bucket privado `rendiciones` ─────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rendiciones',
  'rendiciones',
  false,
  10485760,
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'image/heic', 'image/heif', 'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists rendiciones_select on storage.objects;
create policy rendiciones_select on storage.objects
  for select using (
    bucket_id = 'rendiciones'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.current_role() in ('sales_manager', 'operations', 'admin')
    )
  );

drop policy if exists rendiciones_insert on storage.objects;
create policy rendiciones_insert on storage.objects
  for insert with check (
    bucket_id = 'rendiciones'
    and auth.uid()::text = (storage.foldername(name))[1]
    and public.current_role() in (
      'sales_rep', 'sales_manager', 'operations', 'admin'
    )
  );

drop policy if exists rendiciones_update on storage.objects;
create policy rendiciones_update on storage.objects
  for update using (
    bucket_id = 'rendiciones'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.current_role() in ('sales_manager', 'operations', 'admin')
    )
  );

drop policy if exists rendiciones_delete on storage.objects;
create policy rendiciones_delete on storage.objects
  for delete using (
    bucket_id = 'rendiciones'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.current_role() in ('sales_manager', 'operations', 'admin')
    )
  );

-- ── RPCs (única vía de acceso autenticada) ───────────────────────────────────
create or replace function public.rendicion_list_conceptos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, rendiciones, pg_temp
as $$
declare
  v_role text := public.current_role();
begin
  if v_role is null
     or v_role not in ('sales_rep', 'sales_manager', 'operations', 'admin') then
    raise exception 'not allowed';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'nombre', c.nombre,
          'cod_concepto', c.cod_concepto,
          'centro_costo_id', c.centro_costo_id,
          'centro_nombre', cc.nombre,
          'cod_sector', cc.cod_sector
        )
        order by c.nombre
      )
      from rendiciones.conceptos c
      left join rendiciones.centros_costo cc on cc.id = c.centro_costo_id
      where c.activo
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.rendicion_list_conceptos() from public, anon;
grant execute on function public.rendicion_list_conceptos() to authenticated;

create or replace function public.rendicion_list_mis(p_limit int default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, rendiciones, pg_temp
as $$
declare
  v_role text := public.current_role();
  v_uid uuid := auth.uid();
begin
  if v_role is null
     or v_role not in ('sales_rep', 'sales_manager', 'operations', 'admin') then
    raise exception 'not allowed';
  end if;
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  return coalesce(
    (
      select jsonb_agg(row_to_json(x)::jsonb)
      from (
        select
          c.id,
          c.tipo,
          c.total,
          c.fecha_emision,
          c.tipo_comprobante,
          c.nro_comprobante,
          c.cuit_emisor,
          c.estado,
          c.observaciones,
          c.image_path,
          c.concepto_id,
          conc.nombre as concepto_nombre,
          c.created_at
        from rendiciones.comprobantes c
        left join rendiciones.conceptos conc on conc.id = c.concepto_id
        where c.uploaded_by = v_uid
           or v_role in ('sales_manager', 'operations', 'admin')
        order by c.created_at desc
        limit greatest(1, least(coalesce(p_limit, 100), 500))
      ) x
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.rendicion_list_mis(int) from public, anon;
grant execute on function public.rendicion_list_mis(int) to authenticated;

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

-- Migrar facturas legacy → rendiciones (mismas ids si aún no existen).
insert into rendiciones.comprobantes (
  id,
  uploaded_by,
  cod_vendedor,
  tipo,
  image_path,
  estado,
  fecha_emision,
  total,
  cuit_emisor,
  ocr_raw,
  created_at,
  concepto_id
)
select
  f.id,
  f.uploaded_by,
  f.cod_vendedor,
  coalesce(f.tipo, 'gasto'),
  f.image_path,
  case when f.estado = 'subida' then 'rendido' else coalesce(f.estado, 'rendido') end,
  f.fecha,
  f.monto,
  f.cuit,
  f.ocr_raw,
  f.created_at,
  (
    select c.id
    from rendiciones.conceptos c
    join public.motivos_factura m on m.nombre = c.nombre
    where m.id = f.motivo_id
    limit 1
  )
from public.facturas f
where not exists (
  select 1 from rendiciones.comprobantes c where c.id = f.id
);
