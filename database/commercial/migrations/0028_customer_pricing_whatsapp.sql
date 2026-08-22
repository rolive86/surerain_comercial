-- Platform WhatsApp override (no lo pisa el sync Tango de customers.phone)
alter table public.customer_pricing
  add column if not exists whatsapp_phone text;
