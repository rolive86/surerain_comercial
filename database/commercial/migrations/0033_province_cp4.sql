-- SURE RAIN COMMERCIAL DB — 0033 province from numeric CP4 ranges
-- CPA letra (ya soportado) + CP viejo de 4 dígitos por rangos → 24 jurisdicciones.

create or replace function public.province_from_postal_code(p_cp text)
returns text
language plpgsql
immutable
as $fn$
declare
  v_raw text := upper(btrim(coalesce(p_cp, '')));
  v_letter text;
  v_digits text;
  v_cp int;
begin
  if v_raw = '' then
    return null;
  end if;

  -- CPA con letra inicial (ej. B1878EX, C1426BMD)
  if v_raw ~ '^[A-Z]' then
    v_letter := left(v_raw, 1);
    return case v_letter
      when 'A' then 'Salta'
      when 'B' then 'Buenos Aires'
      when 'C' then 'CABA'
      when 'D' then 'San Luis'
      when 'E' then 'Entre Ríos'
      when 'F' then 'La Rioja'
      when 'G' then 'Santiago del Estero'
      when 'H' then 'Chaco'
      when 'J' then 'San Juan'
      when 'K' then 'Catamarca'
      when 'L' then 'La Pampa'
      when 'M' then 'Mendoza'
      when 'N' then 'Misiones'
      when 'P' then 'Formosa'
      when 'Q' then 'Neuquén'
      when 'R' then 'Río Negro'
      when 'S' then 'Santa Fe'
      when 'T' then 'Tucumán'
      when 'U' then 'Chubut'
      when 'V' then 'Tierra del Fuego'
      when 'W' then 'Corrientes'
      when 'X' then 'Córdoba'
      when 'Y' then 'Jujuy'
      when 'Z' then 'Santa Cruz'
      else null
    end;
  end if;

  -- CP viejo numérico de 4 dígitos (extrae primeros 4 dígitos)
  v_digits := substring(regexp_replace(v_raw, '[^0-9]', '', 'g') from 1 for 4);
  if v_digits is null or length(v_digits) < 4 then
    return null;
  end if;
  v_cp := v_digits::int;

  -- Rangos tradicionales (Correo / Wikipedia) refinados a provincia.
  -- Best-effort: zonas limítrofes se asignan a la jurisdicción mayoritaria.
  return case
    -- 1xxx: CABA (1000–1499) y BA norte (1600–1999; 1500s raros → BA)
    when v_cp between 1000 and 1499 then 'CABA'
    when v_cp between 1500 and 1999 then 'Buenos Aires'

    -- 2xxx: Santa Fe / BA norte / Entre Ríos (franjas)
    when v_cp between 2000 and 2399 then 'Santa Fe'          -- Rosario, Rafaela
    when v_cp between 2400 and 2599 then 'Córdoba'           -- San Francisco / Marcos Juárez
    when v_cp between 2600 and 2699 then 'Santa Fe'          -- Venado Tuerto
    when v_cp between 2700 and 2799 then 'Buenos Aires'      -- Pergamino, Areco
    when v_cp between 2800 and 2849 then 'Buenos Aires'      -- Campana, Zárate
    when v_cp between 2850 and 2899 then 'Entre Ríos'        -- Gualeguaychú
    when v_cp between 2900 and 2999 then 'Buenos Aires'      -- San Nicolás, San Pedro

    -- 3xxx: Litoral / NEA
    when v_cp between 3000 and 3099 then 'Santa Fe'          -- Santa Fe capital
    when v_cp between 3100 and 3199 then 'Entre Ríos'        -- Paraná
    when v_cp between 3200 and 3299 then 'Entre Ríos'        -- Concordia, Colón
    when v_cp between 3300 and 3399 then 'Misiones'          -- Posadas, Eldorado
    when v_cp between 3400 and 3499 then 'Corrientes'
    when v_cp between 3500 and 3599 then 'Chaco'             -- Resistencia (Reconquista SF ~3560: majority Chaco band)
    when v_cp between 3600 and 3699 then 'Formosa'
    when v_cp between 3700 and 3799 then 'Chaco'             -- Sáenz Peña / Quimilí fringe → Chaco
    when v_cp between 3800 and 3899 then 'Formosa'

    -- 4xxx: NOA
    when v_cp between 4000 and 4199 then 'Tucumán'
    when v_cp between 4200 and 4399 then 'Santiago del Estero'
    when v_cp between 4400 and 4599 then 'Salta'
    when v_cp between 4600 and 4699 then 'Jujuy'
    when v_cp between 4700 and 4799 then 'Catamarca'
    when v_cp between 4800 and 4899 then 'Jujuy'

    -- 5xxx: Cuyo / Centro
    when v_cp between 5000 and 5299 then 'Córdoba'
    when v_cp between 5300 and 5399 then 'La Rioja'
    when v_cp between 5400 and 5499 then 'San Juan'
    when v_cp between 5500 and 5699 then 'Mendoza'
    when v_cp between 5700 and 5799 then 'San Luis'
    when v_cp between 5800 and 5999 then 'Córdoba'           -- Río Cuarto / Villa María

    -- 6xxx: BA oeste / La Pampa
    when v_cp between 6000 and 6299 then 'Buenos Aires'      -- Junín, Villegas (Laboulaye fringe → BA band)
    when v_cp between 6300 and 6399 then 'La Pampa'          -- Santa Rosa, General Pico
    when v_cp between 6400 and 6999 then 'Buenos Aires'      -- Trenque Lauquen, Luján, etc.

    -- 7xxx: BA centro / este / sur
    when v_cp between 7000 and 7999 then 'Buenos Aires'      -- Tandil, MdP, Azul, Olavarría

    -- 8xxx: BA sur / Patagonia norte
    when v_cp between 8000 and 8199 then 'Buenos Aires'      -- Bahía Blanca
    when v_cp between 8200 and 8299 then 'La Pampa'          -- General Acha
    when v_cp between 8300 and 8399 then 'Neuquén'           -- Neuquén, Cutral Có (Cipolletti fringe)
    when v_cp between 8400 and 8499 then 'Río Negro'         -- Bariloche
    when v_cp between 8500 and 8599 then 'Río Negro'         -- Viedma (Patagones BA fringe)
    when v_cp between 8600 and 8699 then 'Neuquén'
    when v_cp between 8700 and 8799 then 'Chubut'
    when v_cp between 8800 and 8999 then 'Río Negro'

    -- 9xxx: Patagonia sur
    when v_cp between 9000 and 9299 then 'Chubut'            -- Comodoro, Madryn, Esquel
    when v_cp between 9300 and 9399 then 'Santa Cruz'
    when v_cp between 9400 and 9409 then 'Santa Cruz'        -- Río Gallegos
    when v_cp between 9410 and 9429 then 'Tierra del Fuego' -- Ushuaia / Río Grande
    when v_cp between 9430 and 9999 then 'Santa Cruz'

    else null
  end;
end;
$fn$;

-- Re-derivar province en customers (no toca los sin CP).
update public.customers c
set
  province = public.province_from_postal_code(c.postal_code),
  updated_at = now()
where c.postal_code is not null
  and btrim(c.postal_code) <> '';
