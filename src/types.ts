export type SourceProvenance = {
  source_url: string;
  source_page: string;
  source_selector: string;
  extracted_at: string;
  raw_fields: string[];
};

export type RawProductCard = {
  source_index: number;
  source_id: string;
  name: string;
  slug: string;
  category_slug: string | null;
  brand_name: string | null;
  product_type_slug: string | null;
  markets: string[];
  image_url: string | null;
  image_alt: string | null;
  ficha_url: string | null;
  description: string;
  specs_html: string;
  specs_rows: Array<{ label: string; value: string }>;
  chip_label: string | null;
  original_url: string;
  outer_html: string;
  onclick_raw: string;
  content_hash: string;
  provenance: SourceProvenance;
};

export type RawCatalogSnapshot = {
  fetched_at: string;
  source_url: string;
  final_url: string;
  published_total: number | null;
  published_claim_text: string | null;
  html_sha256: string;
  html_bytes: number;
  product_count: number;
  products: RawProductCard[];
};

export type DiscoveryReport = {
  generated_at: string;
  base_url: string;
  technology: {
    framework: string;
    rendering: string;
    filtering: string;
    product_ui: string;
  };
  endpoints_probed: Array<{
    url: string;
    status: number;
    content_type: string | null;
    notes?: string;
  }>;
  primary_source: {
    url: string;
    type: string;
    reason: string;
  };
  secondary_sources: string[];
  catalog: {
    published_total: number | null;
    categories: string[];
    brands: string[];
    markets: string[];
    product_types: string[];
    cards_detected: number;
    with_ficha: number;
    with_description: number;
    unique_images: number;
    duplicate_names: Array<{ name: string; count: number }>;
  };
  asset_roots: string[];
  site_pages: string[];
  recommended_extraction_method: string;
  notes: string[];
};

export type MediaRecord = {
  id: string;
  type: "image" | "document" | "other";
  role_hint: "featured" | "technical" | "gallery" | "diagram" | "other" | "logo";
  filename: string;
  mime_type: string | null;
  original_url: string;
  local_path: string | null;
  storage_path: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  checksum: string | null;
  alt_text: string | null;
  download_status: "pending" | "downloaded" | "failed" | "skipped";
  error?: string;
  created_at: string;
};

export type NormalizedAttribute = {
  id: string;
  name: string;
  slug: string;
  data_type: "text" | "number" | "boolean" | "json";
  unit: string | null;
  filterable: boolean;
};

export type NormalizedProduct = {
  id: string;
  source_id: string;
  sku: string | null;
  name: string;
  slug: string;
  short_description: string | null;
  description: string;
  status: "active" | "draft" | "archived";
  brand_id: string | null;
  product_type_id: string | null;
  original_url: string;
  featured_image_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
  source_created_at: string | null;
  source_updated_at: string | null;
  source_active: boolean;
  first_seen_at: string;
  last_seen_at: string;
  content_hash: string;
  purchasable: boolean;
  featured: boolean;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  raw_ref: string;
  category_ids: string[];
  primary_category_id: string | null;
  market_ids: string[];
  media_ids: Array<{ media_id: string; role: string; sort_order: number }>;
  document_ids: string[];
  attribute_values: Array<{
    attribute_id: string;
    value_text: string | null;
    value_number: number | null;
    value_boolean: boolean | null;
    value_json: unknown | null;
  }>;
};

export type NormalizedCategory = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  image_id: string | null;
  sort_order: number;
  active: boolean;
  source_id: string;
};

export type NormalizedBrand = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_media_id: string | null;
  active: boolean;
  source_id: string;
};

export type NormalizedMarket = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  source_id: string;
};

export type NormalizedProductType = {
  id: string;
  name: string;
  slug: string;
  source_id: string;
};

export type NormalizedDocument = {
  id: string;
  product_id: string;
  name: string;
  document_type:
    | "ficha_tecnica"
    | "manual"
    | "folleto"
    | "certificado"
    | "catalogo"
    | "otro";
  original_url: string;
  local_path: string | null;
  storage_path: string | null;
  mime_type: string | null;
  checksum: string | null;
  media_id: string | null;
};

export type NormalizedDataset = {
  generated_at: string;
  products: NormalizedProduct[];
  categories: NormalizedCategory[];
  brands: NormalizedBrand[];
  markets: NormalizedMarket[];
  product_types: NormalizedProductType[];
  media: MediaRecord[];
  documents: NormalizedDocument[];
  attributes: NormalizedAttribute[];
  product_categories: Array<{
    product_id: string;
    category_id: string;
    is_primary: boolean;
  }>;
  product_markets: Array<{ product_id: string; market_id: string }>;
  product_media: Array<{
    product_id: string;
    media_id: string;
    role: string;
    sort_order: number;
  }>;
  product_attribute_values: Array<{
    product_id: string;
    attribute_id: string;
    value_text: string | null;
    value_number: number | null;
    value_boolean: boolean | null;
    value_json: unknown | null;
  }>;
  product_variants: Array<{
    id: string;
    product_id: string;
    sku: string | null;
    name: string;
    active: boolean;
    sort_order: number;
  }>;
  prices: unknown[];
  inventory: unknown[];
  sync_meta: {
    run_id: string;
    source_url: string;
    products_seen: number;
    products_new: number;
    products_modified: number;
    products_unchanged: number;
    products_missing_from_source: number;
  };
};
