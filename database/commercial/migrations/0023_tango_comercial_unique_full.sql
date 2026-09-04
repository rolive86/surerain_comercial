-- PostgREST upsert requires a unique constraint (not a partial unique index).
-- PostgreSQL unique indexes allow multiple NULLs, so demos without tango ids stay intact.

drop index if exists public.customers_tango_customer_id_uidx;
create unique index customers_tango_customer_id_uidx
  on public.customers (tango_customer_id);

drop index if exists public.sales_reps_tango_sales_rep_id_uidx;
create unique index sales_reps_tango_sales_rep_id_uidx
  on public.sales_reps (tango_sales_rep_id);
