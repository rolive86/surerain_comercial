-- SURE RAIN COMMERCIAL DB — 0006 backoffice writes (Fase E)

-- Staff / rep can update orders they can see (status changes)
create policy orders_staff_update on public.orders for update using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
) with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
);

create policy orders_rep_update on public.orders for update using (
  public.current_role() = 'sales_rep'
  and customer_id in (select public.current_rep_customer_ids())
) with check (
  public.current_role() = 'sales_rep'
  and customer_id in (select public.current_rep_customer_ids())
);

-- Status history inserts by staff/rep on visible orders
create policy osh_staff_insert on public.order_status_history for insert with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
  and exists (select 1 from public.orders o where o.id = order_id)
);

create policy osh_rep_insert on public.order_status_history for insert with check (
  public.current_role() = 'sales_rep'
  and exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.customer_id in (select public.current_rep_customer_ids())
  )
);

-- Internal notes by staff/rep
create policy notes_staff_insert on public.order_notes for insert with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
  and note_type in ('customer', 'internal')
  and author_user_id = auth.uid()
);

create policy notes_rep_insert on public.order_notes for insert with check (
  public.current_role() = 'sales_rep'
  and note_type in ('customer', 'internal')
  and author_user_id = auth.uid()
  and exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.customer_id in (select public.current_rep_customer_ids())
  )
);

-- Audit log: staff/rep can insert; admin already can select
create policy audit_staff_insert on public.audit_log for insert with check (
  public.current_role() in ('sales_rep', 'sales_manager', 'operations', 'admin')
  and actor_user_id = auth.uid()
);

create policy audit_staff_read on public.audit_log for select using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
);
