-- SURE RAIN COMMERCIAL DB — 0005 carts/orders RLS (Fase C)

alter table public.carts                 enable row level security;
alter table public.cart_items            enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.order_status_history  enable row level security;
alter table public.order_notes           enable row level security;
alter table public.order_addresses       enable row level security;

-- ---------- carts ----------
create policy carts_customer_select on public.carts for select using (
  public.current_role() = 'customer_user'
  and user_id = auth.uid()
  and customer_id = public.current_customer_id()
);
create policy carts_customer_insert on public.carts for insert with check (
  public.current_role() = 'customer_user'
  and user_id = auth.uid()
  and customer_id = public.current_customer_id()
);
create policy carts_customer_update on public.carts for update using (
  public.current_role() = 'customer_user'
  and user_id = auth.uid()
  and customer_id = public.current_customer_id()
) with check (
  public.current_role() = 'customer_user'
  and user_id = auth.uid()
  and customer_id = public.current_customer_id()
);

create policy carts_staff_select on public.carts for select using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
  or (
    public.current_role() = 'sales_rep'
    and customer_id in (select public.current_rep_customer_ids())
  )
);

-- ---------- cart_items ----------
create policy cart_items_customer_select on public.cart_items for select using (
  exists (
    select 1 from public.carts c
    where c.id = cart_id
      and c.user_id = auth.uid()
      and c.customer_id = public.current_customer_id()
      and public.current_role() = 'customer_user'
  )
);
create policy cart_items_customer_insert on public.cart_items for insert with check (
  exists (
    select 1 from public.carts c
    where c.id = cart_id
      and c.user_id = auth.uid()
      and c.customer_id = public.current_customer_id()
      and c.status = 'open'
      and public.current_role() = 'customer_user'
  )
);
create policy cart_items_customer_update on public.cart_items for update using (
  exists (
    select 1 from public.carts c
    where c.id = cart_id
      and c.user_id = auth.uid()
      and c.customer_id = public.current_customer_id()
      and c.status = 'open'
      and public.current_role() = 'customer_user'
  )
) with check (
  exists (
    select 1 from public.carts c
    where c.id = cart_id
      and c.user_id = auth.uid()
      and c.customer_id = public.current_customer_id()
      and c.status = 'open'
      and public.current_role() = 'customer_user'
  )
);
create policy cart_items_customer_delete on public.cart_items for delete using (
  exists (
    select 1 from public.carts c
    where c.id = cart_id
      and c.user_id = auth.uid()
      and c.customer_id = public.current_customer_id()
      and c.status = 'open'
      and public.current_role() = 'customer_user'
  )
);

create policy cart_items_staff_select on public.cart_items for select using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
  or (
    public.current_role() = 'sales_rep'
    and exists (
      select 1 from public.carts c
      where c.id = cart_id
        and c.customer_id in (select public.current_rep_customer_ids())
    )
  )
);

-- ---------- orders ----------
create policy orders_customer_select on public.orders for select using (
  public.current_role() = 'customer_user'
  and customer_id = public.current_customer_id()
);
create policy orders_customer_insert on public.orders for insert with check (
  public.current_role() = 'customer_user'
  and customer_id = public.current_customer_id()
  and user_id = auth.uid()
);
create policy orders_rep_select on public.orders for select using (
  public.current_role() = 'sales_rep'
  and customer_id in (select public.current_rep_customer_ids())
);
create policy orders_staff_select on public.orders for select using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
);

-- ---------- order_items ----------
create policy order_items_customer_select on public.order_items for select using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and public.current_role() = 'customer_user'
      and o.customer_id = public.current_customer_id()
  )
);
create policy order_items_customer_insert on public.order_items for insert with check (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and public.current_role() = 'customer_user'
      and o.customer_id = public.current_customer_id()
      and o.user_id = auth.uid()
  )
);
create policy order_items_rep_select on public.order_items for select using (
  public.current_role() = 'sales_rep'
  and exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.customer_id in (select public.current_rep_customer_ids())
  )
);
create policy order_items_staff_select on public.order_items for select using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
);

-- ---------- order_status_history ----------
create policy osh_customer_select on public.order_status_history for select using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and public.current_role() = 'customer_user'
      and o.customer_id = public.current_customer_id()
  )
);
create policy osh_customer_insert on public.order_status_history for insert with check (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and public.current_role() = 'customer_user'
      and o.customer_id = public.current_customer_id()
      and o.user_id = auth.uid()
  )
);
create policy osh_rep_select on public.order_status_history for select using (
  public.current_role() = 'sales_rep'
  and exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.customer_id in (select public.current_rep_customer_ids())
  )
);
create policy osh_staff_select on public.order_status_history for select using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
);

-- ---------- order_notes ----------
create policy notes_customer_select on public.order_notes for select using (
  public.current_role() = 'customer_user'
  and note_type = 'customer'
  and exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_id = public.current_customer_id()
  )
);
create policy notes_customer_insert on public.order_notes for insert with check (
  public.current_role() = 'customer_user'
  and note_type = 'customer'
  and author_user_id = auth.uid()
  and exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.customer_id = public.current_customer_id()
      and o.user_id = auth.uid()
  )
);
create policy notes_staff_select on public.order_notes for select using (
  public.current_role() in ('sales_rep', 'sales_manager', 'operations', 'admin')
  and (
    public.current_role() in ('sales_manager', 'operations', 'admin')
    or exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.customer_id in (select public.current_rep_customer_ids())
    )
  )
);

-- ---------- order_addresses ----------
create policy addresses_customer_select on public.order_addresses for select using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and public.current_role() = 'customer_user'
      and o.customer_id = public.current_customer_id()
  )
);
create policy addresses_customer_insert on public.order_addresses for insert with check (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and public.current_role() = 'customer_user'
      and o.customer_id = public.current_customer_id()
      and o.user_id = auth.uid()
  )
);
create policy addresses_staff_select on public.order_addresses for select using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
  or (
    public.current_role() = 'sales_rep'
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.customer_id in (select public.current_rep_customer_ids())
    )
  )
);

-- Allow authenticated to execute order number helper (used server-side via RPC)
grant execute on function public.next_order_number() to authenticated;
grant usage, select on sequence public.order_number_seq to authenticated;
