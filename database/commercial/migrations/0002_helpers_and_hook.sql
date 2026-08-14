-- Helpers de autorización
create or replace function public.current_role() returns text
language sql stable as $$
  select coalesce(auth.jwt()->>'app_role', 'anon')
$$;

create or replace function public.current_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select customer_id from public.app_user_links
  where user_id = auth.uid() and active
$$;

create or replace function public.current_rep_customer_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select csr.customer_id
  from public.app_user_links l
  join public.customer_sales_rep csr on csr.sales_rep_id = l.sales_rep_id
  where l.user_id = auth.uid() and l.active and csr.active
    and (csr.valid_to is null or csr.valid_to > now())
$$;

-- ============ CUSTOM ACCESS TOKEN HOOK ============
-- Inyecta app_role / customer_id / sales_rep_id en el JWT.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare
  claims   jsonb;
  v_role   text;
  v_cust   uuid;
  v_rep    uuid;
begin
  select role, customer_id, sales_rep_id into v_role, v_cust, v_rep
  from public.app_user_links
  where user_id = (event->>'user_id')::uuid and active;

  claims := event->'claims';

  if v_role is not null then
    claims := jsonb_set(claims, '{app_role}', to_jsonb(v_role));
    if v_cust is not null then
      claims := jsonb_set(claims, '{customer_id}', to_jsonb(v_cust));
    end if;
    if v_rep is not null then
      claims := jsonb_set(claims, '{sales_rep_id}', to_jsonb(v_rep));
    end if;
  else
    claims := jsonb_set(claims, '{app_role}', to_jsonb('anon'::text));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Permisos para que Auth pueda ejecutar el hook y leer los links
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on public.app_user_links to supabase_auth_admin;
