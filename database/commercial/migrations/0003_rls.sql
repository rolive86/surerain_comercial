alter table public.customers            enable row level security;
alter table public.customer_contacts    enable row level security;
alter table public.sales_reps           enable row level security;
alter table public.customer_sales_rep   enable row level security;
alter table public.app_user_links       enable row level security;
alter table public.order_statuses       enable row level security;
alter table public.audit_log            enable row level security;

-- app_user_links: cada usuario lee su propia fila; auth admin (hook) lee todo; staff lee todo
create policy aul_self_read on public.app_user_links for select using (user_id = auth.uid());
create policy aul_admin_read on public.app_user_links for select to supabase_auth_admin using (true);
create policy aul_staff_read on public.app_user_links for select using (
  public.current_role() in ('sales_manager','admin')
);

-- customers
create policy customers_customer_read on public.customers for select using (
  public.current_role() = 'customer_user' and id = public.current_customer_id()
);
create policy customers_rep_read on public.customers for select using (
  public.current_role() = 'sales_rep' and id in (select public.current_rep_customer_ids())
);
create policy customers_staff_read on public.customers for select using (
  public.current_role() in ('sales_manager','operations','admin')
);

-- customer_contacts (mismo scoping vía customer_id)
create policy contacts_customer_read on public.customer_contacts for select using (
  public.current_role() = 'customer_user' and customer_id = public.current_customer_id()
);
create policy contacts_rep_read on public.customer_contacts for select using (
  public.current_role() = 'sales_rep' and customer_id in (select public.current_rep_customer_ids())
);
create policy contacts_staff_read on public.customer_contacts for select using (
  public.current_role() in ('sales_manager','operations','admin')
);

-- sales_reps: staff todo; rep su propia fila; customer ve su rep asignado
create policy reps_staff_read on public.sales_reps for select using (
  public.current_role() in ('sales_manager','operations','admin')
);
create policy reps_self_read on public.sales_reps for select using (
  public.current_role() = 'sales_rep'
  and id = (select sales_rep_id from public.app_user_links where user_id = auth.uid() and active)
);
create policy reps_customer_read on public.sales_reps for select using (
  public.current_role() = 'customer_user'
  and id in (
    select csr.sales_rep_id from public.customer_sales_rep csr
    where csr.customer_id = public.current_customer_id() and csr.active
      and (csr.valid_to is null or csr.valid_to > now())
  )
);

-- customer_sales_rep
create policy csr_staff_read on public.customer_sales_rep for select using (
  public.current_role() in ('sales_manager','operations','admin')
);
create policy csr_rep_read on public.customer_sales_rep for select using (
  public.current_role() = 'sales_rep' and customer_id in (select public.current_rep_customer_ids())
);
create policy csr_customer_read on public.customer_sales_rep for select using (
  public.current_role() = 'customer_user' and customer_id = public.current_customer_id()
);

-- order_statuses: lookup público para autenticados
create policy statuses_read on public.order_statuses for select
  to authenticated using (true);

-- audit_log: sólo admin
create policy audit_admin_read on public.audit_log for select using (
  public.current_role() = 'admin'
);
