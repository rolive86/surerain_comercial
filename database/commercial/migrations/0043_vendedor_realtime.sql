-- SURE RAIN COMMERCIAL DB — 0043 Realtime for Vendedor PWA/TWA
-- Additive. Enables supabase_realtime only on tables the sales_rep UI refreshes.
-- RLS continues to gate row visibility; publication alone does not expose data.

alter publication supabase_realtime add table public.products_tango;
alter publication supabase_realtime add table public.sales_history;

comment on table public.products_tango is
  'Catálogo Tango + stock. Realtime: Stock vendedor (0043).';
