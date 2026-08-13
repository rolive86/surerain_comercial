-- Sure Rain ecommerce catalog schema + RLS + storage buckets
-- Project: sure_rain_ecommerce_db (alewhpkjiktmvbugkcnn)
-- gen_random_uuid() available via pgcrypto (already installed)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Taxonomies
-- ---------------------------------------------------------------------------

CREATE TABLE brands (
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

CREATE TABLE markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  source_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  source_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('image', 'document', 'other')),
  filename TEXT NOT NULL,
  mime_type TEXT,
  original_url TEXT NOT NULL,
  local_path TEXT,
  bucket TEXT,
  storage_path TEXT,
  width INTEGER,
  height INTEGER,
  file_size BIGINT,
  checksum TEXT,
  alt_text TEXT,
  download_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (download_status IN ('pending', 'downloaded', 'failed', 'skipped', 'uploaded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_original_url_unique UNIQUE (original_url)
);

CREATE INDEX media_checksum_idx
  ON media (checksum)
  WHERE checksum IS NOT NULL;

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_id UUID REFERENCES media(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  source_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);

ALTER TABLE brands
  ADD CONSTRAINT brands_logo_media_id_fkey
  FOREIGN KEY (logo_media_id) REFERENCES media(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------

CREATE TABLE products (
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

CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_type ON products(product_type_id);
CREATE INDEX idx_products_source_active ON products(source_active);
CREATE INDEX idx_products_published ON products(published);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_content_hash ON products(content_hash);

CREATE TABLE product_categories (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX idx_product_categories_category ON product_categories(category_id);

CREATE TABLE product_markets (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, market_id)
);

CREATE TABLE product_media (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('featured', 'gallery', 'technical', 'diagram', 'other')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, media_id, role)
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL
    CHECK (document_type IN ('ficha_tecnica', 'manual', 'folleto', 'certificado', 'catalogo', 'otro')),
  original_url TEXT NOT NULL,
  local_path TEXT,
  bucket TEXT,
  storage_path TEXT,
  mime_type TEXT,
  checksum TEXT,
  media_id UUID REFERENCES media(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT documents_product_url_unique UNIQUE (product_id, original_url)
);

CREATE INDEX idx_documents_product ON documents(product_id);

CREATE TABLE attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  data_type TEXT NOT NULL DEFAULT 'text'
    CHECK (data_type IN ('text', 'number', 'boolean', 'json')),
  unit TEXT,
  filterable BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_attribute_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number DOUBLE PRECISION,
  value_boolean BOOLEAN,
  value_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_pav_product_attr_text
  ON product_attribute_values (product_id, attribute_id, md5(coalesce(value_text, '')))
  WHERE value_text IS NOT NULL;

CREATE INDEX idx_pav_product ON product_attribute_values(product_id);
CREATE INDEX idx_pav_attribute ON product_attribute_values(attribute_id);

CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT,
  name TEXT NOT NULL DEFAULT 'Default',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE UNIQUE INDEX uq_variants_product_sku
  ON product_variants(product_id, sku)
  WHERE sku IS NOT NULL;

CREATE TABLE prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'ARS',
  amount NUMERIC(12, 2) NOT NULL,
  compare_at_amount NUMERIC(12, 2),
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prices_variant ON prices(product_variant_id);

CREATE TABLE inventory (
  variant_id UUID PRIMARY KEY REFERENCES product_variants(id) ON DELETE CASCADE,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  available BOOLEAN NOT NULL DEFAULT FALSE,
  allow_backorder BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sync_runs (
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
COMMENT ON COLUMN products.published IS 'Public catalog visibility for ecommerce storefront';
COMMENT ON COLUMN prices.amount IS 'Do not invent; populate only from real price lists';
COMMENT ON COLUMN media.bucket IS 'Supabase Storage bucket id';
COMMENT ON COLUMN media.storage_path IS 'Path inside bucket; public URL derived at runtime';

-- ---------------------------------------------------------------------------
-- RLS — public read for published catalog; no anonymous writes
-- ---------------------------------------------------------------------------

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;

-- Public SELECT policies
CREATE POLICY brands_public_read ON brands
  FOR SELECT TO anon, authenticated
  USING (active = TRUE);

CREATE POLICY markets_public_read ON markets
  FOR SELECT TO anon, authenticated
  USING (TRUE);

CREATE POLICY product_types_public_read ON product_types
  FOR SELECT TO anon, authenticated
  USING (TRUE);

CREATE POLICY categories_public_read ON categories
  FOR SELECT TO anon, authenticated
  USING (active = TRUE);

CREATE POLICY media_public_read ON media
  FOR SELECT TO anon, authenticated
  USING (TRUE);

CREATE POLICY products_public_read ON products
  FOR SELECT TO anon, authenticated
  USING (published = TRUE AND source_active = TRUE);

CREATE POLICY product_categories_public_read ON product_categories
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_id AND p.published = TRUE AND p.source_active = TRUE
    )
  );

CREATE POLICY product_markets_public_read ON product_markets
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_id AND p.published = TRUE AND p.source_active = TRUE
    )
  );

CREATE POLICY product_media_public_read ON product_media
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_id AND p.published = TRUE AND p.source_active = TRUE
    )
  );

CREATE POLICY documents_public_read ON documents
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_id AND p.published = TRUE AND p.source_active = TRUE
    )
  );

CREATE POLICY attributes_public_read ON attributes
  FOR SELECT TO anon, authenticated
  USING (TRUE);

CREATE POLICY product_attribute_values_public_read ON product_attribute_values
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_id AND p.published = TRUE AND p.source_active = TRUE
    )
  );

CREATE POLICY product_variants_public_read ON product_variants
  FOR SELECT TO anon, authenticated
  USING (
    active = TRUE AND EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_id AND p.published = TRUE AND p.source_active = TRUE
    )
  );

-- prices/inventory: no public read yet (no invented ecommerce data; hide until real)
-- sync_runs: admin only (no public policy)

-- Explicit deny of writes for anon/authenticated is default with RLS ON and no write policies.
-- service_role bypasses RLS.

-- ---------------------------------------------------------------------------
-- Storage buckets (public read, no public write)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('product-images', 'product-images', TRUE, 20971520, ARRAY['image/webp','image/jpeg','image/png','image/gif','image/svg+xml']),
  ('product-documents', 'product-documents', TRUE, 52428800, ARRAY['image/webp','image/jpeg','image/png','application/pdf']),
  ('category-images', 'category-images', TRUE, 20971520, ARRAY['image/webp','image/jpeg','image/png','image/svg+xml']),
  ('brand-assets', 'brand-assets', TRUE, 20971520, ARRAY['image/webp','image/jpeg','image/png','image/svg+xml'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read for catalog asset buckets
CREATE POLICY storage_public_read_product_images
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY storage_public_read_product_documents
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-documents');

CREATE POLICY storage_public_read_category_images
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'category-images');

CREATE POLICY storage_public_read_brand_assets
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'brand-assets');

-- No INSERT/UPDATE/DELETE policies for anon/authenticated on these buckets.
