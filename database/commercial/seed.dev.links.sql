-- DEV SEED — borrar en prod
-- Sure Rain commercial — usuarios demo Auth + entidades de prueba
-- cliente.demo@surerain.test  → f6292bdd-5e3b-407f-84eb-5b58c51fe0ca
-- vendedor.demo@surerain.test → c8e8427a-b9be-4765-8f78-b6e8612d6849

-- 1) Cliente demo
insert into public.customers (
  id, legal_name, trade_name, email, source_system, active
) values (
  '11111111-1111-4111-8111-111111111111',
  'Cliente Demo SRL',
  'Cliente Demo',
  'cliente.demo@surerain.test',
  'platform',
  true
)
on conflict (id) do update set
  legal_name = excluded.legal_name,
  trade_name = excluded.trade_name,
  email = excluded.email,
  active = true,
  updated_at = now();

-- Cliente NO asignado (para validar que RLS no lo expone a demo)
insert into public.customers (
  id, legal_name, trade_name, email, source_system, active
) values (
  '11111111-1111-4111-8111-111111111199',
  'Cliente No Asignado SRL',
  'No Asignado',
  'noasignado.demo@surerain.test',
  'platform',
  true
)
on conflict (id) do nothing;

-- 2) Vendedor demo
insert into public.sales_reps (
  id, name, email, source_system, active
) values (
  '22222222-2222-4222-8222-222222222222',
  'Vendedor Demo',
  'vendedor.demo@surerain.test',
  'platform',
  true
)
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  active = true;

-- 3) Asignación cliente ↔ vendedor
insert into public.customer_sales_rep (
  id, customer_id, sales_rep_id, active, valid_from
) values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  true,
  now()
)
on conflict (id) do update set
  active = true,
  valid_to = null;

-- 4) Puente auth.users ↔ rol comercial
insert into public.app_user_links (
  user_id, role, customer_id, sales_rep_id, active
) values
  (
    'f6292bdd-5e3b-407f-84eb-5b58c51fe0ca',
    'customer_user',
    '11111111-1111-4111-8111-111111111111',
    null,
    true
  ),
  (
    'c8e8427a-b9be-4765-8f78-b6e8612d6849',
    'sales_rep',
    null,
    '22222222-2222-4222-8222-222222222222',
    true
  )
on conflict (user_id) do update set
  role = excluded.role,
  customer_id = excluded.customer_id,
  sales_rep_id = excluded.sales_rep_id,
  active = true;
