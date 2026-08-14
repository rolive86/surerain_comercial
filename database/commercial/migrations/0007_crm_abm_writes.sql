-- SURE RAIN COMMERCIAL DB — 0007 CRM ABM writes (Fase F)
-- Escritura de maestro: sales_manager / operations / admin
-- sales_rep sigue con SELECT scoped (Fase A)

-- customers
create policy customers_staff_insert on public.customers for insert with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
);
create policy customers_staff_update on public.customers for update using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
) with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
);

-- customer_contacts
create policy contacts_staff_insert on public.customer_contacts for insert with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
);
create policy contacts_staff_update on public.customer_contacts for update using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
) with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
);
create policy contacts_staff_delete on public.customer_contacts for delete using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
);

-- sales_reps
create policy reps_staff_insert on public.sales_reps for insert with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
);
create policy reps_staff_update on public.sales_reps for update using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
) with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
);

-- customer_sales_rep assignments
create policy csr_staff_insert on public.customer_sales_rep for insert with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
);
create policy csr_staff_update on public.customer_sales_rep for update using (
  public.current_role() in ('sales_manager', 'operations', 'admin')
) with check (
  public.current_role() in ('sales_manager', 'operations', 'admin')
);
