-- SURE RAIN COMMERCIAL DB — 0013 security hardening
-- Additive. Cierra WARNs de search_path mutable y EXECUTE público de setup/helpers.

-- 1) search_path fijo en funciones marcadas mutables
alter function public.custom_access_token_hook(jsonb) set search_path = public, pg_temp;
alter function public.set_updated_at()               set search_path = public, pg_temp;
alter function public.current_role()                 set search_path = public, pg_temp;
alter function public.next_order_number()            set search_path = public, pg_temp;

-- 2) rls_auto_enable(): utilidad de setup, no debe ser RPC público
revoke execute on function public.rls_auto_enable() from anon, authenticated;

-- 3) helpers RLS: sacar EXECUTE sólo a anon (NO a authenticated: rompería la RLS)
revoke execute on function public.current_customer_id()      from anon;
revoke execute on function public.current_rep_customer_ids() from anon;
