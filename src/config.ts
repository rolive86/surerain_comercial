import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT = path.resolve(__dirname, "..");
export const BASE_URL = "https://surerain.com";
export const CATALOG_PATH = "/catalogo";
export const CATALOG_URL = `${BASE_URL}${CATALOG_PATH}`;
export const CANONICAL_CATALOG_URL = `${BASE_URL}/catalogo.html`;

export const USER_AGENT =
  "SurerainCatalogArchive/1.0 (+local archival; public catalog only; contact: local)";

export const RATE_LIMIT_MS = 350;
export const MAX_CONCURRENCY = 3;
export const REQUEST_TIMEOUT_MS = 45_000;
export const MAX_RETRIES = 4;

export const PATHS = {
  original: path.join(ROOT, "original"),
  originalHtml: path.join(ROOT, "original", "html"),
  originalCss: path.join(ROOT, "original", "css"),
  originalJs: path.join(ROOT, "original", "js"),
  originalAssets: path.join(ROOT, "original", "assets"),
  media: path.join(ROOT, "media"),
  mediaProducts: path.join(ROOT, "media", "products"),
  mediaCategories: path.join(ROOT, "media", "categories"),
  mediaBrands: path.join(ROOT, "media", "brands"),
  mediaDocuments: path.join(ROOT, "media", "documents"),
  data: path.join(ROOT, "data"),
  dataRaw: path.join(ROOT, "data", "raw"),
  dataNormalized: path.join(ROOT, "data", "normalized"),
  dataExports: path.join(ROOT, "data", "exports"),
  database: path.join(ROOT, "database"),
  migrations: path.join(ROOT, "database", "migrations"),
  reports: path.join(ROOT, "reports"),
  checkpoints: path.join(ROOT, ".checkpoints"),
} as const;

export const MARKET_LABELS: Record<string, string> = {
  agro: "Agro",
  av: "Áreas Verdes",
  infra: "Infraestructura",
  hogar: "Jardinería Hogar",
};

export const CATEGORY_LABELS: Record<string, string> = {
  aspersores: "Aspersores",
  goteo: "Goteo",
  microaspersion: "Microaspersión",
  filtros: "Filtros",
  valvulas: "Válvulas",
  programadores: "Programadores",
  conectores: "Conectores",
  accesorios: "Accesorios tuberías",
  caudalimetros: "Caudalímetros",
  hogar: "Jardinería Hogar",
};

export const SITE_PAGES = [
  "/",
  "/catalogo",
  "/novedades",
  "/nosotros",
  "/contacto",
  "/manuales-2",
  "/videos",
  "/privacidad",
] as const;

export const STORAGE_BUCKETS = {
  productImages: "product-images",
  categoryImages: "category-images",
  brandAssets: "brand-assets",
  productDocuments: "product-documents",
} as const;
