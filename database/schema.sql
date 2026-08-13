-- Sure Rain catalog schema (PostgreSQL / Supabase)
-- Generated for archival → ecommerce migration.
-- Apply with: psql / Supabase SQL editor. Do not invent prices/stock.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Taxonomies
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_media_id UUID,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  source_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  source_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  source_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_id UUID,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  source_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- ---------------------------------------------------------------------------
-- Media
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('image', 'document', 'other')),
  filename TEXT NOT NULL,
  mime_type TEXT,
  original_url TEXT NOT NULL,
  local_path TEXT,
  storage_path TEXT,
  width INTEGER,
  height INTEGER,
  file_size BIGINT,
  checksum TEXT,
  alt_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_original_url_unique UNIQUE (original_url)
);

CREATE INDEX IF NOT EXISTS idx_media_checksum ON media(checksum);

ALTER TABLE brands
  DROP CONSTRAINT IF EXISTS brands_logo_media_id_fkey;
ALTER TABLE brands
  ADD CONSTRAINT brands_logo_media_id_fkey
  FOREIGN KEY (logo_media_id) REFERENCES media(id) ON DELETE SET NULL;

ALTER TABLE categories
  DROP CONSTRAINT IF EXISTS categories_image_id_fkey;
ALTER TABLE categories
  ADD CONSTRAINT categories_image_id_fkey
  FOREIGN KEY (image_id) REFERENCES media(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL UNIQUE,
  sku TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'draft', 'archived')),
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  product_type_id UUID REFERENCES product_types(id) ON DELETE SET NULL,
  original_url TEXT NOT NULL,
  featured_image_id UUID REFERENCES media(id) ON DELETE SET NULL,
  seo_title TEXT,
  seo_description TEXT,
  source_created_at TIMESTAMPTZ,
  source_updated_at TIMESTAMPTZ,
  source_active BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_hash TEXT NOT NULL,
  purchasable BOOLEAN NOT NULL DEFAULT FALSE,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type_id);
CREATE INDEX IF NOT EXISTS idx_products_source_active ON products(source_active);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_content_hash ON products(content_hash);

CREATE TABLE IF NOT EXISTS product_categories (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_category ON product_categories(category_id);

CREATE TABLE IF NOT EXISTS product_markets (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, market_id)
);

CREATE TABLE IF NOT EXISTS product_media (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('featured', 'gallery', 'technical', 'diagram', 'other')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, media_id, role)
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL
    CHECK (document_type IN ('ficha_tecnica', 'manual', 'folleto', 'certificado', 'catalogo', 'otro')),
  original_url TEXT NOT NULL,
  local_path TEXT,
  storage_path TEXT,
  mime_type TEXT,
  checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_product ON documents(product_id);

-- ---------------------------------------------------------------------------
-- Flexible attributes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  data_type TEXT NOT NULL DEFAULT 'text'
    CHECK (data_type IN ('text', 'number', 'boolean', 'json')),
  unit TEXT,
  filterable BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_attribute_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number DOUBLE PRECISION,
  value_boolean BOOLEAN,
  value_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pav_product ON product_attribute_values(product_id);
CREATE INDEX IF NOT EXISTS idx_pav_attribute ON product_attribute_values(attribute_id);

-- ---------------------------------------------------------------------------
-- Ecommerce-ready (empty initially — do not invent data)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT,
  name TEXT NOT NULL DEFAULT 'Default',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_variants_product_sku
  ON product_variants(product_id, sku)
  WHERE sku IS NOT NULL;

CREATE TABLE IF NOT EXISTS prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'ARS',
  amount NUMERIC(12, 2) NOT NULL,
  compare_at_amount NUMERIC(12, 2),
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prices_variant ON prices(product_variant_id);

CREATE TABLE IF NOT EXISTS inventory (
  variant_id UUID PRIMARY KEY REFERENCES product_variants(id) ON DELETE CASCADE,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  available BOOLEAN NOT NULL DEFAULT FALSE,
  allow_backorder BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Sync / audit helpers
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  products_seen INTEGER,
  products_new INTEGER,
  products_modified INTEGER,
  products_missing INTEGER,
  notes TEXT
);

COMMENT ON TABLE products IS 'Catalog products archived from surerain.com/catalogo';
COMMENT ON COLUMN products.source_id IS 'Stable id from source image filename (img:...)';
COMMENT ON COLUMN products.content_hash IS 'Hash of source payload for change detection';
COMMENT ON COLUMN products.source_active IS 'False when product disappears from source (manual review)';
COMMENT ON COLUMN prices.amount IS 'Do not invent; populate only from real price lists';
