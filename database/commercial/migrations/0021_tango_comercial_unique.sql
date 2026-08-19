-- Unique tango keys for idempotent upsert. NULLs (demos) can coexist.
-- source_system on assignments to mark Tango-originated links.

create unique index if not exists customers_tango_customer_id_uidx
  on public.customers (tango_customer_id)
  where tango_customer_id is not null;

create unique index if not exists sales_reps_tango_sales_rep_id_uidx
  on public.sales_reps (tango_sales_rep_id)
  where tango_sales_rep_id is not null;

alter table public.customer_sales_rep
  add column if not exists source_system text not null default 'platform';
