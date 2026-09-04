-- Allow service-role scripts to read clientes/vendedores staging (schema tango is not in PostgREST).

create or replace function public.tango_staging_fetch(p_entity text)
returns jsonb
language plpgsql security definer set search_path = tango, public, pg_temp as $$
begin
  if p_entity = 'articulos' then
    return coalesce((select jsonb_agg(to_jsonb(t)) from tango.articulos_raw t), '[]'::jsonb);
  elsif p_entity = 'listas_precios' then
    return coalesce((select jsonb_agg(to_jsonb(t)) from tango.listas_precios_raw t), '[]'::jsonb);
  elsif p_entity = 'precios' then
    return coalesce((select jsonb_agg(to_jsonb(t)) from tango.precios_raw t), '[]'::jsonb);
  elsif p_entity = 'articulos_specs' then
    return coalesce((select jsonb_agg(to_jsonb(t)) from tango.articulos_specs_raw t), '[]'::jsonb);
  elsif p_entity = 'clientes' then
    return coalesce((select jsonb_agg(to_jsonb(t)) from tango.clientes_raw t), '[]'::jsonb);
  elsif p_entity = 'vendedores' then
    return coalesce((select jsonb_agg(to_jsonb(t)) from tango.vendedores_raw t), '[]'::jsonb);
  else
    raise exception 'unknown tango fetch entity: %', p_entity;
  end if;
end;
$$;

revoke execute on function public.tango_staging_fetch(text) from public;
revoke execute on function public.tango_staging_fetch(text) from anon, authenticated;
grant execute on function public.tango_staging_fetch(text) to service_role;
