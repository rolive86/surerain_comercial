-- One active sales-rep assignment per customer (prevents espejo sync duplicates).
create unique index if not exists customer_sales_rep_one_active_uq
  on public.customer_sales_rep (customer_id)
  where active and valid_to is null;
