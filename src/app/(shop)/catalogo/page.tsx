import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CatalogFilters } from "@/components/CatalogFilters";
import { ProductGrid } from "@/components/ProductCard";
import { TangoCatalogFilters } from "@/components/TangoCatalogFilters";
import {
  getBrands,
  getCatalogProducts,
  getCategories,
  getMarkets,
  getProductTypes,
} from "@/lib/catalog";
import { getCommercialSession } from "@/lib/commercial/session";
import { withProductCodes } from "@/lib/commercial/product-codes";
import {
  getTangoFamilias,
  getTangoProducts,
} from "@/lib/commercial/products-tango";
import { getStockAvailabilityMany } from "@/lib/commercial/stock";
import { isCustomerRole, isStaffRole } from "@/lib/commercial/roles";

export const metadata: Metadata = {
  title: "Catálogo",
  description:
    "Catálogo completo de productos de riego Sure Rain. Filtrá por categoría, marca, mercado y tipo.",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const session = await getCommercialSession();
  const portalTango =
    isCustomerRole(session?.claims.app_role) || isStaffRole(session?.claims.app_role);
  const staffMode = isStaffRole(session?.claims.app_role);

  if (portalTango) {
    return <TangoCatalogView searchParams={sp} staffMode={staffMode} />;
  }

  return <PublicCatalogView searchParams={sp} />;
}

async function TangoCatalogView({
  searchParams: sp,
  staffMode = false,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  staffMode?: boolean;
}) {
  const filters = {
    q: typeof sp.q === "string" ? sp.q : undefined,
    familia: typeof sp.familia === "string" ? sp.familia : undefined,
    disponibilidad: typeof sp.disp === "string" ? sp.disp : undefined,
  };
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);

  let products: Awaited<ReturnType<typeof getTangoProducts>> = [];
  let familias: Awaited<ReturnType<typeof getTangoFamilias>> = [];
  let errorMessage: string | null = null;

  try {
    [products, familias] = await Promise.all([
      getTangoProducts(filters),
      getTangoFamilias(),
    ]);
  } catch (err) {
    errorMessage =
      err instanceof Error ? err.message : "Error al cargar el catálogo Tango.";
  }

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const sliced = products.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageItems = sliced;
  const stockByCode = staffMode
    ? await getStockAvailabilityMany(
        pageItems.map((p) => p.tangoCode ?? p.source_id),
      )
    : undefined;

  const qs = new URLSearchParams();
  if (filters.q) qs.set("q", filters.q);
  if (filters.familia) qs.set("familia", filters.familia);
  if (filters.disponibilidad) qs.set("disp", filters.disponibilidad);
  const base = qs.toString();
  const hrefFor = (p: number) => {
    const next = new URLSearchParams(base);
    if (p > 1) next.set("page", String(p));
    const s = next.toString();
    return s ? `/catalogo?${s}` : "/catalogo";
  };

  return (
    <div className="container-sr py-8 sm:py-12">
      <div className="mb-6 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sr-green">
          {staffMode ? "Gestión" : "Pedido"}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-sr-ink sm:text-4xl">
          Catálogo Tango
        </h1>
        <p className="mt-3 text-sr-ink/60">
          {staffMode
            ? "Disponibilidad: real (Tango), cotizado (órdenes vivas) y libre."
            : "Artículos con precio o stock (empresa Sure Rain). Armá tu solicitud de cotización; el vendedor te responde con el PDF."}
        </p>
      </div>

      {errorMessage ? (
        <div className="surface border-red-200 bg-red-50/70 px-5 py-6 text-sm text-red-800">
          {errorMessage}
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
          <Suspense fallback={<div className="skeleton h-40" />}>
            <TangoCatalogFilters familias={familias} total={products.length} />
          </Suspense>
          <div className="space-y-6">
            <ProductGrid
              products={pageItems}
              authenticated={!staffMode}
              staffStock={staffMode}
              stockByCode={stockByCode}
              emptyMessage="Ningún artículo coincide con los filtros."
            />
            {totalPages > 1 ? (
              <nav
                className="flex flex-wrap items-center justify-center gap-2 pb-4"
                aria-label="Paginación"
              >
                {safePage > 1 ? (
                  <Link href={hrefFor(safePage - 1)} className="btn-secondary !min-h-11">
                    Anterior
                  </Link>
                ) : null}
                <span className="px-3 text-sm text-sr-ink/55">
                  {safePage} / {totalPages}
                </span>
                {safePage < totalPages ? (
                  <Link href={hrefFor(safePage + 1)} className="btn-secondary !min-h-11">
                    Siguiente
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

async function PublicCatalogView({
  searchParams: sp,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = {
    q: typeof sp.q === "string" ? sp.q : undefined,
    category: typeof sp.categoria === "string" ? sp.categoria : undefined,
    brand: typeof sp.marca === "string" ? sp.marca : undefined,
    market: typeof sp.mercado === "string" ? sp.mercado : undefined,
    type: typeof sp.tipo === "string" ? sp.tipo : undefined,
  };
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);

  let products: Awaited<ReturnType<typeof getCatalogProducts>> = [];
  let categories: Awaited<ReturnType<typeof getCategories>> = [];
  let brands: Awaited<ReturnType<typeof getBrands>> = [];
  let markets: Awaited<ReturnType<typeof getMarkets>> = [];
  let types: Awaited<ReturnType<typeof getProductTypes>> = [];
  let errorMessage: string | null = null;

  try {
    [products, categories, brands, markets, types] = await Promise.all([
      getCatalogProducts(filters),
      getCategories(),
      getBrands(),
      getMarkets(),
      getProductTypes(),
    ]);
  } catch (err) {
    errorMessage =
      err instanceof Error ? err.message : "Error al cargar el catálogo.";
  }

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const sliced = products.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageItems = await withProductCodes(sliced);

  const qs = new URLSearchParams();
  if (filters.q) qs.set("q", filters.q);
  if (filters.category) qs.set("categoria", filters.category);
  if (filters.brand) qs.set("marca", filters.brand);
  if (filters.market) qs.set("mercado", filters.market);
  if (filters.type) qs.set("tipo", filters.type);
  const base = qs.toString();
  const hrefFor = (p: number) => {
    const next = new URLSearchParams(base);
    if (p > 1) next.set("page", String(p));
    const s = next.toString();
    return s ? `/catalogo?${s}` : "/catalogo";
  };

  return (
    <div className="container-sr py-8 sm:py-12">
      <div className="mb-6 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sr-green">
          Productos
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-sr-ink sm:text-4xl">
          Catálogo
        </h1>
        <p className="mt-3 text-sr-ink/60">
          Vidriera pública. Ingresá para armar pedidos con precios y stock Tango.
        </p>
      </div>

      {errorMessage ? (
        <div className="surface border-red-200 bg-red-50/70 px-5 py-6 text-sm text-red-800">
          {errorMessage}
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
          <Suspense fallback={<div className="skeleton h-40" />}>
            <CatalogFilters
              categories={categories}
              brands={brands}
              markets={markets}
              types={types}
              total={products.length}
            />
          </Suspense>
          <div className="space-y-6">
            <ProductGrid
              products={pageItems}
              authenticated={false}
              emptyMessage="Ningún producto coincide con los filtros."
            />
            {totalPages > 1 ? (
              <nav
                className="flex flex-wrap items-center justify-center gap-2 pb-4"
                aria-label="Paginación"
              >
                {safePage > 1 ? (
                  <Link href={hrefFor(safePage - 1)} className="btn-secondary !min-h-11">
                    Anterior
                  </Link>
                ) : null}
                <span className="px-3 text-sm text-sr-ink/55">
                  {safePage} / {totalPages}
                </span>
                {safePage < totalPages ? (
                  <Link href={hrefFor(safePage + 1)} className="btn-secondary !min-h-11">
                    Siguiente
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
