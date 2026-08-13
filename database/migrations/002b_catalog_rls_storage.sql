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
