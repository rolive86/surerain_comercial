-- SURE RAIN COMMERCIAL DB — 0015 pricing RLS
-- Additive. SELECT por rol; sin policies de write (sólo service-role).

alter table public.price_lists         enable row level security;
alter table public.prices              enable row level security;
alter table public.customer_price_list enable row level security;

create policy pl_customer_read on public.price_lists for select using (
  public.current_role() = 'customer_user' and id in (select public.current_customer_price_list_ids())
);
create policy pl_rep_read on public.price_lists for select using (
  public.current_role() = 'sales_rep' and id in (
    select cpl.price_list_id from public.customer_price_list cpl
    where cpl.customer_id in (select public.current_rep_customer_ids()) and cpl.active
      and (cpl.valid_to is null or cpl.valid_to > now())
  )
);
create policy pl_staff_read on public.price_lists for select using (
  public.current_role() in ('sales_manager','operations','admin')
);

create policy prices_customer_read on public.prices for select using (
  public.current_role() = 'customer_user' and price_list_id in (select public.current_customer_price_list_ids())
);
create policy prices_rep_read on public.prices for select using (
  public.current_role() = 'sales_rep' and price_list_id in (
    select cpl.price_list_id from public.customer_price_list cpl
    where cpl.customer_id in (select public.current_rep_customer_ids()) and cpl.active
      and (cpl.valid_to is null or cpl.valid_to > now())
  )
);
create policy prices_staff_read on public.prices for select using (
  public.current_role() in ('sales_manager','operations','admin')
);

create policy cpl_customer_read on public.customer_price_list for select using (
  public.current_role() = 'customer_user' and customer_id = public.current_customer_id()
);
create policy cpl_rep_read on public.customer_price_list for select using (
  public.current_role() = 'sales_rep' and customer_id in (select public.current_rep_customer_ids())
);
create policy cpl_staff_read on public.customer_price_list for select using (
  public.current_role() in ('sales_manager','operations','admin')
);
