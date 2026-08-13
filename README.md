# Sure Rain — Archivo local + migración Supabase

Copia estructurada del catálogo público de [surerain.com/catalogo](https://surerain.com/catalogo) y carga idempotente al proyecto Supabase **sure_rain_ecommerce_db**.

## Proyecto Supabase

| Campo | Valor |
|-------|--------|
| Nombre | `sure_rain_ecommerce_db` |
| Project ref | `alewhpkjiktmvbugkcnn` |
| URL | `https://alewhpkjiktmvbugkcnn.supabase.co` |
| Región | `us-west-2` |
| Estado | ACTIVE_HEALTHY |

MCP: `supabase-sure_rain_ecommerce_db`

## Arquitectura

```
SURERAIN ORIGINAL (HTML estático)
        ↓
DISCOVERY / EXTRACT / NORMALIZE (local)
        ↓
data/raw + data/normalized + media/
        ↓
npm run import:supabase  (service role)
        ↓
Supabase Postgres + Storage
        ↓
(futuro) Next.js ecommerce
```

Fuente primaria: product-cards embebidos en `/catalogo` (sin API JSON pública).

## Variables de entorno

Creá `.env.local` en la raíz (ya generado; **no se commitea**):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_REF=
```

- `NEXT_PUBLIC_*` → cliente Next.js (browser)
- `SUPABASE_SERVICE_ROLE_KEY` → **solo server-side** (import scripts / API routes)
- Nunca exponer la service role en el frontend

`.gitignore` incluye `.env` y `.env.local`.

## Instalación

```bash
npm install
```

## Pipeline local (Fase 1 — ya ejecutado)

```bash
npm run discover
npm run crawl
npm run extract
npm run normalize
npm run download-media
npm run validate
npm run export:supabase
```

No hace falta re-crawlear salvo actualización del catálogo fuente.

## Importación Supabase (Fase 2)

```bash
# Dry-run: valida schema/relaciones/archivos sin escribir
npm run import:supabase -- --dry-run

# Smoke: 8 productos de distintas categorías + media
npm run import:supabase -- --smoke --limit 8

# Importación completa (idempotente / resumible)
npm run import:supabase

# Auditoría contra Supabase real
npm run validate:supabase
```

Flags útiles:

- `--dry-run` — sin writes
- `--smoke` / `--limit N` — muestra
- `--skip-media` — solo tablas

Checkpoints: `.checkpoints/import-supabase-state.json`

## Schema

- `database/schema.sql` — modelo base
- `database/supabase-schema.sql` — schema aplicado (+ RLS + buckets)
- `database/migrations/002_supabase_catalog_rls_storage.sql`

Tablas: `products`, `categories`, `product_categories`, `brands`, `markets`, `product_markets`, `product_types`, `media`, `product_media`, `documents`, `attributes`, `product_attribute_values`, `product_variants`, `prices`, `inventory`, `sync_runs`.

Identidad estable: `source_id` (no el nombre). Slugs únicos. `content_hash` / `first_seen_at` / `last_seen_at` / `source_active` para sync futuras.

Types generados: `src/types/database.types.ts`

## Storage

Buckets públicos (lectura) / sin escritura anónima:

| Bucket | Uso |
|--------|-----|
| `product-images` | imágenes destacadas |
| `product-documents` | fichas técnicas |
| `category-images` | preparado (vacío) |
| `brand-assets` | preparado (vacío) |

Path: `media/{media_id}/{filename_original}`

Trazabilidad: `original_url → local_path → checksum → bucket/storage_path → producto`

URL pública se deriva en runtime:

`{SUPABASE_URL}/storage/v1/object/public/{bucket}/{storage_path}`

## RLS

- SELECT público (`anon`/`authenticated`) de catálogo publicado (`published=true` y `source_active=true`)
- Sin políticas de INSERT/UPDATE/DELETE para anon → escritura bloqueada
- `prices` / `inventory` / `sync_runs`: RLS on, sin policy de lectura pública (sin datos inventados)
- Service role bypasea RLS (solo scripts/backend)

## Resultados actuales

| Entidad | Local | Supabase |
|---------|------:|---------:|
| Products | 420 | 420 |
| Categories | 10 | 10 |
| Brands | 28 | 28 |
| Markets | 4 | 4 |
| Types | 5 | 5 |
| Media | 536 | 536 |
| Media OK / uploaded | 535 | 535 |
| Documents | 126 | 126 |

1 media 404 en origen (no inventado). 1 producto sin marca en origen.

Reporte: `reports/supabase-validation-report.json`

## Actualizar catálogo en el futuro

```bash
npm run extract
npm run normalize
npm run download-media
npm run import:supabase
npm run validate:supabase
```

Productos que desaparezcan de la fuente quedan con `source_active=false` (no se borran).

## Next.js (próxima fase — no construida aún)

Usar `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` en el cliente.
Service role solo en Server Actions / Route Handlers.
No auth/carrito/checkout todavía.

## Comandos rápidos

```bash
npm run import:supabase -- --dry-run
npm run import:supabase -- --smoke --limit 8
npm run import:supabase
npm run validate:supabase
```
