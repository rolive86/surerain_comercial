-- SURE RAIN COMMERCIAL DB — 0008 CRM ABM writes include sales_rep (Fase F)
-- Amplía ABM writes a sales_rep (además de managers) para operar el portal demo.
-- + autoasignación y contactos en alta reciente.

drop policy if exists customers_staff_insert on public.customers;
drop policy if exists customers_staff_update on public.customers;
drop policy if exists contacts_staff_insert on public.customer_contacts;
drop policy if exists contacts_staff_update on public.customer_contacts;
drop policy if exists contacts_staff_delete on public.customer_contacts;
drop policy if exists reps_staff_insert on public.sales_reps;
drop policy if exists reps_staff_update on public.sales_reps;
drop policy if exists csr_staff_insert on public.customer_sales_rep;
drop policy if exists csr_staff_update on public.customer_sales_rep;

create policy customers_staff_insert on public.customers for insert with check (
  public.current_role() in ('sales_rep', 'sales_manager', 'operations', 'admin')
);
create policy customers_staff_update on public.customers for update using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
  or (
    public.current_role() = 'sales_rep'
    and id in (select public.current_rep_customer_ids())
  )
) with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
  or (
    public.current_role() = 'sales_rep'
    and id in (select public.current_rep_customer_ids())
  )
);

create policy contacts_staff_insert on public.customer_contacts for insert with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
  or (
    public.current_role() = 'sales_rep'
    and (
      customer_id in (select public.current_rep_customer_ids())
      or not exists (
        select 1 from public.customer_sales_rep csr
        where csr.customer_id = customer_contacts.customer_id
          and csr.active
          and csr.valid_to is null
      )
    )
  )
);
create policy contacts_staff_update on public.customer_contacts for update using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
  or (
    public.current_role() = 'sales_rep'
    and customer_id in (select public.current_rep_customer_ids())
  )
) with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
  or (
    public.current_role() = 'sales_rep'
    and customer_id in (select public.current_rep_customer_ids())
  )
);
create policy contacts_staff_delete on public.customer_contacts for delete using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
  or (
    public.current_role() = 'sales_rep'
    and customer_id in (select public.current_rep_customer_ids())
  )
);

create policy reps_staff_insert on public.sales_reps for insert with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
);
create policy reps_staff_update on public.sales_reps for update using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
  or (
    public.current_role() = 'sales_rep'
    and id = (select sales_rep_id from public.app_user_links where user_id = auth.uid() and active limit 1)
  )
) with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
  or (
    public.current_role() = 'sales_rep'
    and id = (select sales_rep_id from public.app_user_links where user_id = auth.uid() and active limit 1)
  )
);

create policy csr_staff_insert on public.customer_sales_rep for insert with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
  or (
    public.current_role() = 'sales_rep'
    and sales_rep_id = (
      select sales_rep_id from public.app_user_links
      where user_id = auth.uid() and active
      limit 1
    )
  )
);
create policy csr_staff_update on public.customer_sales_rep for update using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
) with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
);
