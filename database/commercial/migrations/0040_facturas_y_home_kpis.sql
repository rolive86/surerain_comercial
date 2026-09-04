-- SURE RAIN COMMERCIAL DB — 0040 facturas (gasto/venta) + home KPIs vendedor
-- Centros de costo / motivos: seed mínimo; lista final la define el cliente.
-- Cobranzas: no están en el espejo → Home las marca "Próximamente" en app.

-- ── Catálogos ────────────────────────────────────────────────────────────────
create table if not exists public.centros_costo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true
);

create table if not exists public.motivos_factura (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true
);

insert into public.centros_costo (nombre)
select 'Sin centro'
where not exists (
  select 1 from public.centros_costo where nombre = 'Sin centro'
);

insert into public.motivos_factura (nombre)
select x.nombre
from (values
  ('Combustible'),
  ('Peaje'),
  ('Viáticos'),
  ('Mercadería'),
  ('Otro')
) as x(nombre)
where not exists (
  select 1 from public.motivos_factura m where m.nombre = x.nombre
);

-- ── Facturas ─────────────────────────────────────────────────────────────────
create table if not exists public.facturas (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references auth.users (id),
  cod_vendedor text,
  tipo text check (tipo in ('gasto', 'venta')),
  centro_costo_id uuid references public.centros_costo (id),
  motivo_id uuid references public.motivos_factura (id),
  image_path text not null,
  monto numeric,
  fecha date,
  cuit text,
  ocr_raw jsonb,
  estado text not null default 'subida',
  created_at timestamptz not null default now()
);

create index if not exists facturas_uploaded_by_idx on public.facturas (uploaded_by);
create index if not exists facturas_created_at_idx on public.facturas (created_at desc);

alter table public.centros_costo enable row level security;
alter table public.motivos_factura enable row level security;
alter table public.facturas enable row level security;

drop policy if exists centros_costo_staff_select on public.centros_costo;
create policy centros_costo_staff_select on public.centros_costo
  for select using (
    public.current_role() in (
      'sales_rep', 'sales_manager', 'operations', 'admin'
    )
  );

drop policy if exists motivos_factura_staff_select on public.motivos_factura;
create policy motivos_factura_staff_select on public.motivos_factura
  for select using (
    public.current_role() in (
      'sales_rep', 'sales_manager', 'operations', 'admin'
    )
  );

drop policy if exists fac_own on public.facturas;
create policy fac_own on public.facturas
  for select using (
    uploaded_by = auth.uid()
    or public.current_role() in (
      'sales_manager', 'operations', 'admin'
    )
  );

drop policy if exists fac_ins on public.facturas;
create policy fac_ins on public.facturas
  for insert with check (uploaded_by = auth.uid());

drop policy if exists fac_upd_own on public.facturas;
create policy fac_upd_own on public.facturas
  for update using (
    uploaded_by = auth.uid()
    or public.current_role() in (
      'sales_manager', 'operations', 'admin'
    )
  );

grant select on public.centros_costo to authenticated;
grant select on public.motivos_factura to authenticated;
grant select, insert, update on public.facturas to authenticated;
grant all on public.centros_costo to service_role;
grant all on public.motivos_factura to service_role;
grant all on public.facturas to service_role;

-- ── Storage bucket privado `facturas` ────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'facturas',
  'facturas',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists facturas_select on storage.objects;
create policy facturas_select on storage.objects
  for select using (
    bucket_id = 'facturas'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.current_role() in ('sales_manager', 'operations', 'admin')
    )
  );

drop policy if exists facturas_insert on storage.objects;
create policy facturas_insert on storage.objects
  for insert with check (
    bucket_id = 'facturas'
    and auth.uid()::text = (storage.foldername(name))[1]
    and public.current_role() in (
      'sales_rep', 'sales_manager', 'operations', 'admin'
    )
  );

drop policy if exists facturas_update on storage.objects;
create policy facturas_update on storage.objects
  for update using (
    bucket_id = 'facturas'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.current_role() in ('sales_manager', 'operations', 'admin')
    )
  );

drop policy if exists facturas_delete on storage.objects;
create policy facturas_delete on storage.objects
  for delete using (
    bucket_id = 'facturas'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.current_role() in ('sales_manager', 'operations', 'admin')
    )
  );

-- ── Home KPIs vendedor (día empresa + mes del rep) ───────────────────────────
-- SECURITY DEFINER: el día Sure Rain es transversal (no cartera).
-- Solo agregados; códigos de vendedor sin trim.
create or replace function public.vendedor_home_kpis(
  p_fecha date default (timezone('America/Argentina/Buenos_Aires', now()))::date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := public.current_role();
  v_fecha date := coalesce(
    p_fecha,
    (timezone('America/Argentina/Buenos_Aires', now()))::date
  );
  v_rep_id uuid;
  v_cod text;
  v_mes numeric := 0;
  v_dia numeric := 0;
begin
  if v_role is null
     or v_role not in ('sales_rep', 'sales_manager', 'operations', 'admin') then
    raise exception 'not allowed';
  end if;

  select coalesce(sum(public.sales_line_signed_total(sh.tipo_comprobante, sh.total_facturado)), 0)
  into v_dia
  from public.sales_history sh
  where sh.empresa = '3'
    and sh.fecha = v_fecha
    and not exists (
      select 1 from public.sales_exclusiones x
      where x.cod_articulo = sh.cod_articulo
    );

  begin
    v_rep_id := nullif(auth.jwt() ->> 'sales_rep_id', '')::uuid;
  exception when others then
    v_rep_id := null;
  end;

  if v_rep_id is not null then
    select sr.tango_sales_rep_id
    into v_cod
    from public.sales_reps sr
    where sr.id = v_rep_id;
  end if;

  if v_cod is not null then
    select coalesce(sum(public.sales_line_signed_total(sh.tipo_comprobante, sh.total_facturado)), 0)
    into v_mes
    from public.sales_history sh
    where sh.empresa = '3'
      and sh.cod_vendedor = v_cod
      and extract(year from sh.fecha)::int = extract(year from v_fecha)::int
      and extract(month from sh.fecha)::int = extract(month from v_fecha)::int
      and not exists (
        select 1 from public.sales_exclusiones x
        where x.cod_articulo = sh.cod_articulo
      );
  elsif v_role = 'sales_rep' then
    select coalesce(sum(public.sales_line_signed_total(sh.tipo_comprobante, sh.total_facturado)), 0)
    into v_mes
    from public.sales_history sh
    where sh.empresa = '3'
      and sh.customer_id in (select public.current_rep_customer_ids())
      and extract(year from sh.fecha)::int = extract(year from v_fecha)::int
      and extract(month from sh.fecha)::int = extract(month from v_fecha)::int
      and not exists (
        select 1 from public.sales_exclusiones x
        where x.cod_articulo = sh.cod_articulo
      );
  end if;

  return jsonb_build_object(
    'fecha', v_fecha,
    'cod_vendedor', v_cod,
    'ventas_mes_ars', v_mes,
    'ventas_dia_empresa_ars', v_dia,
    'cobranzas_pendiente', true
  );
end;
$$;

revoke all on function public.vendedor_home_kpis(date) from public, anon;
grant execute on function public.vendedor_home_kpis(date) to authenticated;
