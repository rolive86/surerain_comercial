-- DEV SEED — order statuses v1 (safe to apply; no PII)
-- Los usuarios demo / app_user_links van en seed.dev.links.sql tras crear auth users.

insert into public.order_statuses (code, label, sort_order, is_terminal) values
  ('draft',     'Borrador',   10, false),
  ('submitted', 'Enviado',    20, false),
  ('received',  'Recibido',   30, false),
  ('confirmed', 'Confirmado', 40, false),
  ('completed', 'Finalizado', 90, true),
  ('cancelled', 'Cancelado',  95, true),
  ('rejected',  'Rechazado',  96, true)
on conflict (code) do nothing;
