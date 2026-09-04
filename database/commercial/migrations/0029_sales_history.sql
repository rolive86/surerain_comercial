-- Historial de ventas Tango (copia local de espejo_src.ventas).
-- Nota: 0028 ya se usó para customer_pricing.whatsapp_phone → esta es 0029.

create table if not exists public.sales_history (
  id                  uuid primary key default gen_random_uuid(),
  content_hash        text unique not null,
  nro_comprobante     text,
  tipo_comprobante    text,
  fecha               date,
  cod_cliente         text,
  customer_id         uuid references public.customers(id),
  cod_vendedor        text,
  cod_articulo        text,
  cantidad            numeric,
  precio_unitario_usd numeric,
  total_facturado     numeric,
  moneda              text,
  created_at          timestamptz not null default now()
);

create index if not exists sh_customer_idx on public.sales_history(customer_id);
create index if not exists sh_cod_cliente_idx on public.sales_history(cod_cliente);
create index if not exists sh_articulo_idx on public.sales_history(cod_articulo);
create index if not exists sh_fecha_idx on public.sales_history(fecha);
create index if not exists sh_cust_art_idx on public.sales_history(customer_id, cod_articulo);
create index if not exists sh_nro_idx on public.sales_history(nro_comprobante);

alter table public.sales_history enable row level security;

drop policy if exists sh_staff on public.sales_history;
create policy sh_staff on public.sales_history
  for select using (public.current_role() in ('sales_manager','operations','admin'));

drop policy if exists sh_rep on public.sales_history;
create policy sh_rep on public.sales_history
  for select using (
    public.current_role() = 'sales_rep'
    and customer_id in (select public.current_rep_customer_ids())
  );

drop policy if exists sh_customer on public.sales_history;
create policy sh_customer on public.sales_history
  for select using (
    public.current_role() = 'customer_user'
    and customer_id = public.current_customer_id()
  );

grant select on public.sales_history to authenticated;
grant all on public.sales_history to service_role;

-- Signo: NC* resta
create or replace function public.sales_line_signed_total(p_tipo text, p_total numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_tipo is not null and upper(p_tipo) like 'NC%' then -abs(coalesce(p_total, 0))
    else coalesce(p_total, 0)
  end;
$$;

create or replace function public.sales_line_signed_qty(p_tipo text, p_qty numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_tipo is not null and upper(p_tipo) like 'NC%' then -abs(coalesce(p_qty, 0))
    else coalesce(p_qty, 0)
  end;
$$;

-- Top productos por cliente
create or replace view public.v_client_top_products
with (security_invoker = true) as
select
  customer_id,
  cod_articulo,
  count(*)::int as lineas,
  count(distinct nro_comprobante)::int as veces,
  sum(public.sales_line_signed_qty(tipo_comprobante, cantidad)) as unidades,
  max(fecha) as ultima_compra
from public.sales_history
where customer_id is not null
  and cod_articulo is not null
  and cod_articulo <> ''
group by customer_id, cod_articulo;

-- Cadencia / reorder
create or replace view public.v_client_reorder
with (security_invoker = true) as
with base as (
  select
    customer_id,
    cod_articulo,
    count(distinct fecha)::int as compras,
    min(fecha) as primera,
    max(fecha) as ultima,
    (max(fecha) - min(fecha))::numeric
      / nullif(count(distinct fecha) - 1, 0) as avg_interval_days
  from public.sales_history
  where customer_id is not null
    and cod_articulo is not null
    and cod_articulo <> ''
    and fecha is not null
  group by customer_id, cod_articulo
  having count(distinct fecha) >= 2
)
select
  customer_id,
  cod_articulo,
  compras,
  primera,
  ultima,
  round(avg_interval_days, 1) as avg_interval_days,
  (current_date - ultima) as days_since,
  (current_date - ultima) >= avg_interval_days as due_for_reorder
from base
where avg_interval_days is not null;

-- Resumen comercial
create or replace view public.v_client_sales_summary
with (security_invoker = true) as
select
  customer_id,
  count(distinct nro_comprobante)::int as comprobantes,
  sum(public.sales_line_signed_total(tipo_comprobante, total_facturado)) as total_facturado,
  sum(
    case
      when fecha >= (current_date - interval '12 months')
      then public.sales_line_signed_total(tipo_comprobante, total_facturado)
      else 0
    end
  ) as total_12m,
  max(fecha) as ultima_compra,
  min(fecha) as primera_compra
from public.sales_history
where customer_id is not null
group by customer_id;

grant select on public.v_client_top_products to authenticated;
grant select on public.v_client_reorder to authenticated;
grant select on public.v_client_sales_summary to authenticated;
