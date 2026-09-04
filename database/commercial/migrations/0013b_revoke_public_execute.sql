-- SURE RAIN COMMERCIAL DB — 0013b revoke PUBLIC execute
-- Additive. GRANT PUBLIC seguía dando EXECUTE a anon tras 0013.

revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.current_customer_id() from public;
revoke execute on function public.current_rep_customer_ids() from public;

-- RLS helpers must remain callable by authenticated (policy USING).
grant execute on function public.current_customer_id() to authenticated;
grant execute on function public.current_rep_customer_ids() to authenticated;
