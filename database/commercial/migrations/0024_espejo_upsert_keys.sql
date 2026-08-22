-- Upsert keys for Tango/espejo codes (demos keep null tango_* ids).
-- Partial uniques; coexist with earlier full unique indexes if present.

create unique index if not exists customers_tango_uq
  on public.customers (tango_customer_id)
  where tango_customer_id is not null;

create unique index if not exists sales_reps_tango_uq
  on public.sales_reps (tango_sales_rep_id)
  where tango_sales_rep_id is not null;
