# CONTEXT — Sure Rain (SURERAIN-CLONE)

> Documento de handoff. Estado al **14/08/2026**. Para retomar el proyecto en otra sesión sin re-litigar decisiones ya cerradas.

---

## 1. Qué es el proyecto

Archivo local + ecommerce del catálogo público de [surerain.com/catalogo](https://surerain.com/catalogo).

1. **Fase 1** — Discovery / crawl / extract / normalize / media (local) ✅  
2. **Fase 2** — Migración idempotente a Supabase (Postgres + Storage) ✅  
3. **Fase 3** — Frontend Next.js local (catálogo navegable) ✅  
4. **Fase A B2B** — Proyecto comercial + Auth + RBAC + RLS + login ✅  
5. **Fase B B2B** — Portal autenticado `(shop)` + sesión en header + `/cuenta` enriquecida ✅  
6. **Fase C B2B** — Carrito DB + confirmar pedido (snapshot, sin precios/pago) ✅  
7. **Fase D B2B** — Mis pedidos (lista + detalle + historial de estados) ✅  
8. **Fase E B2B** — Backoffice `/gestion` pedidos (filtros, cambio estado, audit) ✅  
9. **Fase F B2B** — ABM clientes / vendedores / asignaciones + historial + RLS writes ✅  
10. **UX ecommerce-grade (en curso)** — piel Sure Rain, search-first, tab bar mobile, preview Vercel protegido.

Landing de marca para el portal: **`/clientes`**. El enlace desde [surerain.com](https://surerain.com) hacia este portal es un cambio **externo** (fuera de este repo).  

**Fuente de verdad catálogo:** `sure_rain_ecommerce_db`.  
**Fuente de verdad comercial/Auth:** `sure_rain_commercial_db` (MCP `user-supabase-sure_rain_commercial_db`).  
No re-crawlear ni re-importar salvo actualización real del catálogo fuente.

---

## 2. Ruta y entorno

| Campo | Valor |
|-------|--------|
| Path local | `C:\proyectos\SURERAIN-CLONE` |
| Node | ≥ 20 |
| Shell | Windows + PowerShell |
| Dev URL | http://localhost:3000 |
| MCP Supabase | `user-supabase-sure_rain_ecommerce_db` |

**No confundir** con otros MCP Supabase del workspace (hif-asistencia, gestor-cedulas, cpccn, diario, scraper, etc.).

---

## 3. Supabase

| Campo | Valor |
|-------|--------|
| Nombre | `sure_rain_ecommerce_db` |
| Project ref | `alewhpkjiktmvbugkcnn` |
| URL | `https://alewhpkjiktmvbugkcnn.supabase.co` |
| Región | `us-west-2` |
| Estado | ACTIVE_HEALTHY |

### Conteos (validados)

| Entidad | Local | Supabase |
|---------|------:|---------:|
| Products | 420 | 420 |
| Categories | 10 | 10 |
| Brands | 28 | 28 |
| Markets | 4 | 4 |
| Types | 5 | 5 |
| Media | 536 | 536 |
| Media uploaded OK | 535 | 535 |
| Documents | 126 | 126 |

1 media 404 en origen (no inventado). 1 producto sin marca en origen.

### Env (`.env.local`, gitignored)

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_REF=
```

- `NEXT_PUBLIC_*` → frontend Next.js (anon)  
- `SUPABASE_SERVICE_ROLE_KEY` → **solo** scripts de import / server privilegiado  
- **Nunca** service role en componentes cliente  

### Schema / RLS / Storage

- Schema: `database/schema.sql`, `database/supabase-schema.sql`, migraciones en `database/migrations/`
- Types: `src/types/database.types.ts`
- Identidad estable: `source_id` (no el nombre). Slugs únicos. Campos sync: `content_hash`, `first_seen_at`, `last_seen_at`, `source_active`
- RLS: SELECT público de catálogo publicado (`published=true` + `source_active=true`); sin writes anon
- `prices` / `inventory` / `sync_runs`: sin lectura pública (sin datos inventados)

**Buckets públicos (lectura):**

| Bucket | Uso |
|--------|-----|
| `product-images` | imágenes de producto |
| `product-documents` | fichas técnicas |
| `category-images` | preparado (vacío) |
| `brand-assets` | preparado (vacío) |

Path Storage: `media/{media_id}/{filename}`  
URL pública: `{SUPABASE_URL}/storage/v1/object/public/{bucket}/{storage_path}`

---

## 4. Frontend (Fase 3 — hecha)

Stack: **Next.js 15 App Router** + React 19 + TypeScript + Tailwind 3 + `@supabase/supabase-js`.

### Rutas

| Ruta | Qué hace |
|------|----------|
| `/` | Home: header, categorías, muestra de productos |
| `/catalogo` | Catálogo completo (420) + filtros + búsqueda |
| `/catalogo/[slug]` | Ficha: galería, specs, mercados, documentos Storage |

### Estructura clave

```text
src/
  app/
    layout.tsx
    page.tsx
    catalogo/page.tsx
    catalogo/[slug]/page.tsx
  components/
    SiteHeader.tsx
    ProductCard.tsx
    CatalogFilters.tsx   # client (filtros/búsqueda)
  lib/
    catalog.ts           # queries Server Components
    storage.ts           # URLs públicas Storage
    supabase/
      client.ts
      server.ts
  types/
    database.types.ts
```

### Scripts npm (mantener todos)

Frontend: `dev`, `build`, `start`  
Pipeline: `discover`, `crawl`, `extract`, `normalize`, `download-media`, `validate`, `export:supabase`, `import:supabase`, `validate:supabase`, `smoke`, `all`

### Imágenes

`next.config.ts` → `images.remotePatterns` para `alewhpkjiktmvbugkcnn.supabase.co` + `outputFileTracingRoot` del repo (evita confusión con `C:\proyectos\package-lock.json` padre).

### Validación local (13/08/2026)

```text
npm run build → PASS
npm run dev → OK
/, /catalogo, /catalogo/[slug] → 200
Filtros + búsqueda → OK
Storage imágenes + documentos → OK
```

---

## 5. Decisiones cerradas (no re-litigar)

1. **Supabase es la fuente de verdad** del catálogo para el frontend. No volver a scrapear para mostrar productos.
2. **No inventar** precios, descuentos, stock, SKU, reviews ni promociones si no están en DB.
3. **No** carrito / checkout / pagos / login / órdenes / admin en esta etapa.
4. **Service role** solo en scripts de importación; UI usa anon key.
5. **Scripts de crawl/migración** se conservan; no romperlos al tocar `package.json` / `tsconfig`.
6. **Identidad de producto** = `source_id` derivado del media (p.ej. filename); nombres no son únicos.
7. Productos que desaparezcan de la fuente → `source_active=false` (no borrado físico).
8. Diseño: limpio / profesional / responsive; no pixel-perfect de surerain.com todavía. Marca verde Sure Rain (`#006A46`), tipografía Fraunces + Manrope.

---

## 6. Pipeline local (solo si hay que actualizar datos)

```powershell
npm run discover
npm run crawl
npm run extract
npm run normalize
npm run download-media
npm run validate
npm run export:supabase
npm run import:supabase
npm run validate:supabase
```

Import flags: `--dry-run`, `--smoke`, `--limit N`, `--skip-media`  
Checkpoints: `.checkpoints/import-supabase-state.json`

Origen: HTML estático en `/catalogo` (product-cards + `data-*`); **sin API JSON pública**.

---

## 7. Qué NO hacer en la próxima sesión (salvo pedido explícito)

- Re-crawl / re-import masivo “por las dudas”
- Inventar precios o stock
- Implementar carrito, auth, checkout
- Usar imágenes locales si ya están en Storage
- Exponer `SUPABASE_SERVICE_ROLE_KEY` al cliente
- Tocar otros proyectos Supabase del MCP

---

## 8. Próximos pasos naturales (cuando se pida)

- **Fase G+** según `docs/ARCHITECTURE-B2B.md` (precios B2B, sync Tango, etc.)
- Usuario demo `sales_manager` / `admin` (hoy writes CRM también permiten `sales_rep` scoped; alta de vendedores solo gerencia)
- Mejorar performance del catálogo (paginación / lazy)
- Deploy (Vercel) con env de producción  
- **No** re-crawl / inventar precios / tocar ecommerce DB por B2B

---

## 9. Comandos rápidos

```powershell
npm install
npm run dev          # http://localhost:3000
npm run build
npm run typecheck
npm run validate:supabase
```
