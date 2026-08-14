# SURE RAIN — B2B ARCHITECTURE PROPOSAL

> Documento de arquitectura. Estado: **propuesta** al 14/08/2026.
> Base: `context.md` (handoff Sure Rain, estado 13/08/2026) + prompt de evolución B2B.
> Destino en repo: `docs/ARCHITECTURE-B2B.md`.

**Convención:** los ítems marcados `[Verificar]` son supuestos tomados del `context.md`, NO confirmados contra el repo/Supabase en vivo. Hay que validarlos en Cursor/MCP antes de implementar (ver §0).

---

## 0. Antes de escribir una línea de código (validación en Cursor/MCP)

Esto lo hacés vos/Cursor, yo no tengo acceso a tu MCP ni a tu repo en vivo. La arquitectura de abajo asume que estos puntos se confirman:

```powershell
pwd
git status
git log -5 --oneline
```

1. `[Verificar]` Listar proyectos Supabase por MCP y confirmar cuáles NO tocar (hif-asistencia, gestor-cedulas, cpccn, diario, scraper, etc.).
2. `[Verificar]` Confirmar que `sure_rain_ecommerce_db` (`alewhpkjiktmvbugkcnn`) tiene exactamente el schema descripto (420 productos, RLS público de catálogo, buckets).
3. `[Verificar]` **Estabilidad de `source_id`.** Es la pieza sobre la que se apoya todo el vínculo comercial↔catálogo. Confirmar que un re-import NO lo cambia. Si hoy se deriva de filename de media, hay que garantizar que ese derivado sea determinístico e inmutable. Este es el riesgo #1 (ver §12).
4. Decisión de negocio a cerrar YA: **los precios NO viven en el catálogo público.** Van al proyecto comercial. Esto define la línea entre las dos bases.

---

## 1. Decisiones críticas (lo que me pediste que cuestione)

### 1.1. ¿Dónde vive Auth? — Corrección al modelo mental

Tu diagrama pone `Auth / Identity` en la capa Next.js, arriba de las dos DB. **Técnicamente eso no existe así.**

Supabase Auth (GoTrue) no es una capa que flota sobre las bases. `auth.users` es un schema **dentro de un proyecto Supabase puntual**, y los JWT los firma el secret **de ese proyecto**. En una policy RLS, `auth.uid()` / `auth.jwt()` sólo resuelven contra el JWT del propio proyecto. Dos proyectos = dos GoTrue = dos secrets = **dos identidades distintas por defecto**. No hay "auth compartido" nativo.

Next.js **no es el IdP**. Es el que sostiene la sesión y orquesta requests. El IdP es el GoTrue de UN proyecto.

**Veredicto: Auth vive SÓLO en el proyecto comercial.**

Por qué el comercial y no el catálogo:
- Toda la autorización por usuario está del lado comercial (un `customer_user` ve sólo su empresa; un `sales_rep` ve sólo su cartera). Esa RLS necesita `auth.uid()`.
- El catálogo **no necesita saber quién sos**. Hoy sirve datos públicos con anon key, y así se queda. Un usuario logueado navega el catálogo exactamente igual que uno anónimo: son datos públicos.

> Existe la opción de "third-party auth" / compartir JWT secret para que el catálogo valide los JWT del comercial. **No lo hagas.** Es acoplamiento innecesario: el catálogo es público read-only, no hay nada que autorizar por usuario. El único caso donde lo necesitarías es precios/visibilidad por cliente *dentro del catálogo* — y ahí la respuesta correcta es mover esos precios al comercial, no meter auth en el catálogo.

### 1.2. ¿Dos DB separadas o una sola con schemas? — Evaluación honesta

Me pediste que no acepte la decisión sólo porque está escrita. Acá va el análisis real, no la respuesta de manual.

**La separación NO se justifica por "separar tablas".** Eso lo lográs igual con dos schemas (`catalog`, `commercial`) en un solo Postgres + RLS, y te ahorrás tax operativo. Si el argumento fuera sólo "no mezclar", un proyecto con schemas gana.

La separación en **dos proyectos físicos** se justifica sólo por una cosa que un schema NO te da: **aislamiento de blast-radius real.** El catálogo es un dataset público, scrapeado, reconstruible, con un pipeline de re-import destructivo. Los datos comerciales (CUIT, clientes, pedidos, condiciones) son las joyas de la corona. Que un re-crawl mal ejecutado, un `truncate` accidental o una policy floja del catálogo **jamás** puedan tocar datos de clientes, es un beneficio concreto.

Costo de la separación:
- **Operativo (real):** dos sets de migraciones, dos `type-gen`, dos conexiones MCP, dos juegos de env vars. Vos ya manejás varios proyectos Supabase, así que el costo marginal es bajo, pero existe.
- **Integridad referencial (bajo, y por diseño):** no podés hacer FK Postgres entre bases. PERO el diseño **ya** evita FKs cross-DB: usa `source_id` como referencia externa + snapshot en `order_items`. No estás sacrificando ninguna FK que hoy tengas. El costo de integridad es ~cero.

**Veredicto: mantengo las dos DB, pero por la razón correcta (aislamiento), y trazando la línea así:**

| | Catalog DB (`sure_rain_ecommerce_db`) | Commercial DB (`sure_rain_commercial_db`) |
|---|---|---|
| Naturaleza | Product master data, público, reconstruible | La aplicación real |
| Contiene | productos, categorías, marcas, mercados, tipos, media, docs | **auth**, clientes, contactos, vendedores, asignaciones, carrito, pedidos, histórico, precios, auditoría, Tango |
| Auth | ninguna (anon público) | **sí (única fuente de identidad)** |
| RLS | SELECT público de publicado+activo | tenancy estricta por usuario/rol |
| Precios | **no** | **sí** |

**Alternativa igualmente válida (te la dejo explícita):** un solo proyecto con schemas `catalog` + `commercial` es *más simple* y unifica Auth trivialmente. Elegí esa si el aislamiento físico no te pesa tanto. Ambas son correctas **siempre que Auth quede del lado comercial.** No es correcto: Auth en ambos, o Auth "en Next.js".

### 1.3. `orders` vive en la DB comercial — De acuerdo, y lo afilo

Coincido 100%: pedidos NO van al catálogo. El producto se referencia por `source_id` (identidad estable que ya existe) + snapshot. Eso mantiene el histórico coherente aunque cambien nombre/imagen/descripción o se retire un producto (`source_active=false`).

Afilado: separá dos vínculos con distinta garantía.
- **Snapshot (garantía fuerte):** copia congelada de lo que se pidió. Es la verdad histórica. Nunca se rompe.
- **Live-link `product_source_id` (best-effort):** sirve para "recomprar" y "productos habituales". Si un re-import cambia el `source_id`, este link se degrada, pero el snapshot sobrevive. Diseñá la UI para tolerar link roto (ej.: "producto ya no disponible").

### 1.4. Máquina de estados — Está sobre-modelada para v1

Los 11 estados (`draft → … → completed/cancelled/rejected`) son demasiados para una v1 cuyo output es "mandar el pedido a Sure Rain para gestión manual". Vos ya dijiste "no asumir que son definitivos" — coincido y voy más lejos: **hacé los estados DATOS, no enum.**

Tabla `order_statuses` (lookup) + `order_status_history`. v1 arranca con un subconjunto chico; los demás se agregan como filas, sin migración. (Detalle en §7.3.)

### 1.5. Carrito — DB-backed, no sólo localStorage

Coincido con tu instinto. `localStorage` como buffer UX pre-login; al autenticarse se hace *merge* al carrito en DB. La sesión autenticada siempre recupera su carrito desde el comercial. (Detalle en §8.)

---

## 2. Arquitectura general

```
                         NEXT.JS 15 (App Router) — una sola app
                                      │
              ┌───────────────────────┴───────────────────────┐
              │ commercialClient (con sesión)                  │ catalogClient (anon, público)
              │ = IdP + toda la autorización                   │ = read-only product master
              ▼                                                ▼
   COMMERCIAL SUPABASE (sure_rain_commercial_db)     CATALOG SUPABASE (sure_rain_ecommerce_db)
   ├── auth.users  ← ÚNICA identidad                 ├── products / categories / brands
   ├── customers / customer_contacts                 ├── markets / types
   ├── sales_reps / customer_sales_rep               ├── media / documents
   ├── app_user_links (user ↔ entidad + rol)         └── Storage (imágenes, fichas)
   ├── carts / cart_items                                (SIN CAMBIOS — se preserva)
   ├── orders / order_items
   ├── order_status_history / order_notes / order_addresses
   ├── price_lists / prices        (scaffold, futuro)
   ├── audit_log
   └── sync_runs + columnas external-id
                     │
                     ▼
             INTEGRATION LAYER (server-only)
                     │
                   TANGO (futuro — no se implementa hoy)
```

Regla de oro: **el frontend habla con nuestra plataforma; la plataforma sincroniza con Tango.** El request de un usuario nunca llama a Tango en línea. Si Tango está caído, la plataforma sigue funcionando.

---

## 3. Responsabilidades de cada Supabase

**Catalog (`sure_rain_ecommerce_db`) — se preserva tal cual.**
- Fuente de verdad del catálogo. No re-crawlear/re-importar salvo actualización real.
- Acceso: anon key, SELECT público de `published=true AND source_active=true`.
- No conoce usuarios. No tiene precios comerciales. No tiene pedidos.
- `[Verificar]` No tocar su RLS actual ni sus buckets.

**Commercial (`sure_rain_commercial_db`) — nuevo.**
- IdP único (Auth/GoTrue).
- Dueño de clientes, vendedores, asignaciones, carrito, pedidos, histórico, precios, auditoría.
- RLS estricta por tenant/rol.
- Punto de integración con Tango.

---

## 4. Estrategia Auth (detalle)

- **Supabase Auth en el proyecto comercial**, único.
- B2B: **sin signup público libre.** Clientes creados/invitados por Sure Rain (invite por email o alta administrativa). `[Decisión]` empezar con invitación admin + recuperación de contraseña; nada de registro abierto.
- En Next.js, **dos clients**:
  - `catalogClient` → proyecto catálogo, anon, sólo lecturas públicas de catálogo.
  - `commercialClient` → proyecto comercial, con sesión del usuario. Todo lo transaccional pasa por acá.
- La sesión (cookies) es la del proyecto comercial. El middleware de Next protege rutas autenticadas y backoffice; el catálogo queda abierto.
- `service_role` **sólo** server-side (server actions / route handlers / connector Tango). Nunca en cliente. (Ya es tu regla en el catálogo; se mantiene.)

**Claims de rol vía Custom Access Token Hook.** Al emitir el JWT, un hook agrega claims: `app_role` y, según el caso, `customer_id` o `sales_rep_id`. Así la RLS de casos gruesos lee `auth.jwt()->>'app_role'` sin subquery por fila. (Ojo: los claims quedan "viejos" hasta refresh de token; para decisiones que deben ser instantáneas usá subquery contra la tabla — ver §11.)

---

## 5. Roles (RBAC)

| Rol | Ve | No ve / no puede |
|---|---|---|
| `customer_user` | su empresa, catálogo, sus pedidos, su carrito | otras empresas, otros pedidos, backoffice |
| `sales_rep` | clientes asignados + sus pedidos/histórico | cartera completa automáticamente |
| `sales_manager` | vendedores, clientes, pedidos, reasignaciones, métricas | (config admin) |
| `operations` | pedidos y su gestión operativa | según se defina |
| `admin` | todo | — |

RBAC reforzado en **DB con RLS**, no sólo ocultando botones. Protección explícita contra IDOR: `customer_id` / `sales_rep_id` **siempre** se derivan de la sesión server-side, nunca del payload del cliente. RLS es el backstop.

---

## 6. Modelo clientes / vendedores / usuarios

Separá tres cosas que no son lo mismo: `auth.users` (login) ≠ `customers` (empresa) ≠ `sales_reps` (vendedor). Una empresa puede tener varios usuarios.

DDL orientativo (proyecto comercial) — `[propuesta, verificar]`:

```sql
-- Cliente comercial (empresa)
create table customers (
  id            uuid primary key default gen_random_uuid(),   -- PK NUESTRA
  external_id       text,          -- patrón ID externo
  tango_customer_id text,          -- código Tango (futuro)
  source_system     text default 'platform',
  legal_name    text not null,
  trade_name    text,
  cuit          text,
  tax_condition text,
  email         text,
  phone         text,
  address       text, city text, province text, postal_code text,
  active        boolean not null default true,
  last_synced_at timestamptz,
  sync_status    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  name text, email text, phone text, position text,
  is_primary boolean default false, active boolean default true
);

create table sales_reps (
  id uuid primary key default gen_random_uuid(),   -- PK NUESTRA
  external_id text, tango_sales_rep_id text, source_system text default 'platform',
  name text not null, email text, active boolean default true,
  last_synced_at timestamptz, sync_status text
);

-- Asignación cliente↔vendedor CON HISTÓRICO (no 1:1 eterno)
create table customer_sales_rep (
  id uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id),
  sales_rep_id uuid not null references sales_reps(id),
  valid_from timestamptz not null default now(),
  valid_to   timestamptz,                 -- null = vigente
  active     boolean not null default true
);

-- Puente auth.users ↔ entidad comercial + rol
create table app_user_links (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role         text not null,             -- customer_user | sales_rep | sales_manager | operations | admin
  customer_id  uuid references customers(id),   -- si es customer_user
  sales_rep_id uuid references sales_reps(id),   -- si es staff-vendedor
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
```

Nota: `id` interno siempre UUID nuestro; `tango_*_id` es un atributo, **nunca** la PK. No acoplar la PK a Tango.

---

## 7. Modelo de pedidos

### 7.1. `orders`

```sql
create table orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  text unique not null,        -- legible, secuencial (ej. SR-2026-00012)
  customer_id   uuid not null references customers(id),
  user_id       uuid not null references auth.users(id),   -- quién lo cargó
  sales_rep_id  uuid references sales_reps(id),            -- snapshot del asignado al momento
  status        text not null references order_statuses(code),
  submitted_at  timestamptz,
  source        text not null default 'portal',           -- portal | backoffice | tango
  -- IDs externos para sync futura
  external_id text, tango_id text, last_synced_at timestamptz, sync_status text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

### 7.2. `order_items` (con snapshot — clave)

```sql
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  -- Referencia al catálogo (best-effort, cross-DB, SIN FK)
  product_source_id text not null,          -- identidad estable del catálogo
  -- Snapshot congelado (garantía fuerte, verdad histórica)
  product_name_snapshot text not null,
  sku_snapshot          text,
  description_snapshot  text,
  unit_snapshot         text,
  quantity              numeric not null check (quantity > 0),
  unit_price_snapshot   numeric,            -- null hoy (sin precios), listo para cuando existan
  discount_snapshot     numeric,
  metadata_snapshot     jsonb default '{}'::jsonb
);
```

El snapshot es lo que hace que un pedido de hace 6 meses siga siendo coherente aunque el producto cambie o desaparezca del catálogo.

### 7.3. Estados como datos

```sql
create table order_statuses (
  code text primary key,          -- draft, submitted, received, confirmed, completed, cancelled, rejected...
  label text not null,
  sort_order int not null,
  is_terminal boolean not null default false,
  active boolean not null default true
);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  from_status text references order_statuses(code),
  to_status   text not null references order_statuses(code),
  changed_by  uuid references auth.users(id),
  comment     text,
  created_at  timestamptz not null default now()
);
```

**v1 arranca con:** `draft`, `submitted`, `received`, `confirmed`, `completed`, `cancelled`, `rejected`. El resto (`under_review`, `preparing`, `ready`, `dispatched`) se *seedean* como filas cuando la operación los necesite. Cero migraciones para evolucionar el flujo. Nunca guardar sólo `status` sin history.

### 7.4. Notas y direcciones

```sql
create table order_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  note_type text not null check (note_type in ('customer','internal')),  -- separación dura
  body text not null,
  author_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table order_addresses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  kind text not null default 'shipping',   -- shipping | billing
  company text, contact text, address text, city text, province text,
  postal_code text, observations text
);
```

`internal_notes` (RLS: sólo staff) y `customer_notes` **nunca** se mezclan. El cliente jamás debe recibir una nota interna por accidente. La RLS de `order_notes` filtra `note_type='internal'` para roles cliente.

---

## 8. Modelo de carrito

```sql
create table carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  customer_id uuid not null references customers(id),
  status text not null default 'open',    -- open | converted | abandoned
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id) where (status = 'open')  -- un carrito abierto por usuario
);

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  product_source_id text not null,
  product_name_snapshot text not null,     -- para UI sin depender del catálogo en cada render
  quantity numeric not null check (quantity > 0),
  unit_snapshot text,
  added_at timestamptz not null default now(),
  unique (cart_id, product_source_id)
);
```

Flujo: `localStorage` como apoyo UX antes de login → al autenticar se hace merge (upsert por `product_source_id`) al carrito DB → al confirmar, el carrito se convierte en `order` + `order_items` (copiando snapshots) y pasa a `status='converted'`. El CTA final es **`Confirmar pedido`**, no pago.

---

## 9. RLS (detalle)

Helpers (evitan recursión y repsetición):

```sql
create or replace function current_role() returns text
language sql stable as $$ select coalesce(auth.jwt()->>'app_role','anon') $$;

create or replace function current_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select customer_id from app_user_links where user_id = auth.uid() and active
$$;

create or replace function current_rep_customer_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select csr.customer_id
  from app_user_links l
  join customer_sales_rep csr on csr.sales_rep_id = l.sales_rep_id
  where l.user_id = auth.uid() and l.active and csr.active
    and (csr.valid_to is null or csr.valid_to > now())
$$;
```

Policies representativas (mismo patrón para el resto):

```sql
-- orders: cliente ve sólo su empresa
alter table orders enable row level security;

create policy orders_customer_read on orders for select using (
  current_role() = 'customer_user' and customer_id = current_customer_id()
);

-- orders: vendedor ve sólo su cartera
create policy orders_rep_read on orders for select using (
  current_role() = 'sales_rep' and customer_id in (select current_rep_customer_ids())
);

-- orders: manager/admin ven todo
create policy orders_staff_read on orders for select using (
  current_role() in ('sales_manager','operations','admin')
);

-- order_notes: cliente NUNCA ve internas
create policy notes_customer_read on order_notes for select using (
  current_role() = 'customer_user'
  and note_type = 'customer'
  and order_id in (select id from orders where customer_id = current_customer_id())
);
```

Principios: least privilege; validación server-side siempre; ownership verificado por RLS (no confiar en el front); `service_role` sólo server-side; anti-IDOR (los IDs de tenant salen de la sesión). Índices en `orders(customer_id)`, `customer_sales_rep(sales_rep_id, active)`, etc., por la subquery de vendedor.

---

## 10. Separación frontend cliente / backoffice

Una sola app Next.js, con route groups y layouts distintos (no microfrontends):

```
src/app/
  (marketing)/            # opcional: home pública actual
  (shop)/                 # layout ecommerce
    catalogo/             # YA EXISTE — se preserva (público, catalogClient)
    catalogo/[slug]/      # YA EXISTE — se preserva
    carrito/              # requiere sesión
    mis-pedidos/          # requiere sesión
    cuenta/               # requiere sesión
  (auth)/
    login/
  (backoffice)/           # layout admin, requiere rol staff
    gestion/
      pedidos/
      clientes/
      vendedores/
```

- El catálogo (`/`, `/catalogo`, `/catalogo/[slug]`) **queda igual y público**: filtros, búsqueda, imágenes y documentos desde Storage siguen funcionando con `catalogClient`. No se rompe nada.
- `(shop)` autenticado y `(backoffice)` protegidos por middleware (redirect a `/login`; backoffice exige rol staff).
- Layouts visualmente separados: experiencia ecommerce vs. experiencia administrativa.

Ingeniería: separación dominio/UI; server components para lectura; server actions / route handlers para escritura; capa de servicios (`lib/services/*`) + data-access; schemas de validación (zod) en el borde; TS estricto; manejo de errores y logging; sin SQL disperso en componentes; sin lógica de negocio en React. Sin sobre-ingeniería (nada de Kubernetes, CQRS porque sí, event buses sin necesidad).

---

## 11. Riesgo de claims vs. autorización instantánea

`app_role` en el JWT es cómodo pero queda "viejo" hasta el refresh del token. Regla:
- **Rol grueso** (customer vs staff) → claim JWT, OK.
- **Pertenencia dinámica** (qué clientes ve un vendedor, revocaciones) → subquery contra tabla (`current_rep_customer_ids()`), para que un cambio tenga efecto inmediato.

---

## 12. Integración futura Tango

No se implementa hoy. La arquitectura ya queda lista:

- **Dirección:** `Tango → Integration Layer → Normalization → Commercial DB → Plataforma`. El frontend nunca depende de Tango.
- **IDs externos** desde el día 1 en `customers`, `sales_reps`, `orders`, `price_lists`: `external_id`, `source_system`, `tango_id`, `last_synced_at`, `sync_status`. PK interna siempre nuestra.
- **`sync_runs`** (una fila por corrida: entidad, inicio/fin, contadores, estado, errores). Upserts idempotentes keyed por `tango_*_id`.
- **Source-of-truth por campo** (a definir cuando haya API): probablemente Tango dueño del maestro de clientes/vendedores/precios; la plataforma dueña de pedidos hasta empujarlos.
- **No inventar la API de Tango.** No asumir endpoints. El connector es un módulo server-only aislado, reemplazable.

---

## 13. Auditoría

```sql
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  action text not null,             -- status_change | reassign | customer_update | ...
  entity_type text not null, entity_id uuid,
  before jsonb, after jsonb,
  created_at timestamptz not null default now()
);
```

Prioridad: cambios de estado, reasignaciones vendedor↔cliente, modificaciones de clientes, cambios comerciales. Escritura server-side.

---

## 14. Notificaciones (sólo scaffold)

No implementar sistema complejo aún. Dejar tabla `notifications` / eventos (`order_received`, `status_changed`, `confirmed`, `dispatched`) para poblar después. Canales futuros: email (Resend, que ya usás), WhatsApp, in-app. **No** implementar WhatsApp sin API/credenciales reales.

---

## 15. Riesgos (resumen)

1. **`source_id` frágil.** Si un re-import cambia el `source_id`, se degrada el live-link comercial↔catálogo. Mitigación: verificar/congelar estabilidad de `source_id` (§0.3); el snapshot cubre el histórico; UI tolerante a link roto.
2. **Tax operativo de dos proyectos.** Dos migraciones, dos type-gen, dos MCP. Aceptado conscientemente a cambio de aislamiento.
3. **Complejidad RLS vendedor→cartera.** Subquery por fila; indexar y testear con datos reales. Considerar caché de claims para lo grueso.
4. **Sin FK cross-DB → riesgo de huérfanos.** Mitigado por snapshots; el link es best-effort.
5. **Staleness de claims JWT.** Rol grueso por claim, pertenencia dinámica por subquery.
6. **Precios filtrándose al catálogo público.** Decisión temprana: precios sólo en comercial. No agregar precios a tablas del catálogo.
7. **IDOR.** IDs de tenant siempre desde la sesión, nunca del payload; RLS como backstop.

---

## 16. Fases propuestas

Ajusté ligeramente tu A–H (secuencia más segura):

- **Fase A — Fundaciones.** Proyecto comercial + Auth + `app_user_links` + RBAC + RLS base + columnas external-id + helpers. Sin UI salvo login. `[Verificar MCP antes]`
- **Fase B — Portal cliente autenticado.** Layout `(shop)`, `/login`, `/cuenta`. Catálogo sigue público; se agrega sesión alrededor.
- **Fase C — Carrito + pedido.** `carts`/`cart_items` DB-backed, merge desde localStorage, `Confirmar pedido` → `orders`+`order_items` con snapshot + `order_status_history`. Pantalla de confirmación.
- **Fase D — Mis pedidos.** Lista + detalle + historial de estados (vista cliente).
- **Fase E — Backoffice.** Shell `(backoffice)` + panel de pedidos (lista/filtros por cliente/vendedor/fecha/estado/número) + cambio de estado con history + audit.
- **Fase F — Clientes / vendedores / asignaciones.** ABM + vistas scoped por vendedor (RLS probada) + histórico de asignación.
- **Fase G — Scaffold connector Tango.** Integration layer, `sync_runs`, mapping, dry-run. (Los external-id ya vienen de Fase A.)
- **Fase H — Integración Tango real.** Sólo cuando haya endpoints/credenciales reales.

Después de cada fase: `typecheck`, `build`, pruebas, revisión de seguridad, migraciones aplicadas, validación RLS. Commits atómicos por sprint, sólo tras test end-to-end. `.env.local` nunca se commitea.

---

## 17. Cambios que haría AHORA (antes de features)

1. `[MCP]` Confirmar proyectos Supabase y crear `sure_rain_commercial_db`. Auth ahí.
2. `[Catálogo]` Verificar/congelar estabilidad de `source_id`. Decidir formalmente: precios NO en catálogo.
3. `[Comercial]` Migración inicial: `customers`, `customer_contacts`, `sales_reps`, `customer_sales_rep`, `app_user_links`, `order_statuses` (seed v1), con columnas external-id desde el día 1.
4. `[Next.js]` Dos clients Supabase separados (`catalogClient` anon / `commercialClient` con sesión) + env vars nuevas del proyecto comercial. No exponer service role al cliente.
5. `[Next.js]` Route groups `(shop)` / `(auth)` / `(backoffice)` + middleware, **sin tocar** `/`, `/catalogo`, `/catalogo/[slug]`.
6. `[Auth]` Custom Access Token Hook con claim `app_role` (+ `customer_id`/`sales_rep_id`).
7. `[Seguridad]` RLS base + helpers (`current_role`, `current_customer_id`, `current_rep_customer_ids`) y tests de IDOR.

---

## 18. Lo que NO se toca / NO se hace

- No re-crawlear ni re-importar el catálogo "por las dudas".
- No inventar precios, stock, SKU, descuentos, reviews.
- No pago online (MercadoPago/Stripe/tarjeta) en esta etapa. CTA final = `Confirmar pedido`.
- No FK Postgres cross-DB.
- No Auth en el catálogo ni Auth duplicado.
- No romper el frontend de catálogo actual.
- No tocar otros proyectos Supabase del workspace.
