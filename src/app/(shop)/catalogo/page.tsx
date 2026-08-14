import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogFilters } from "@/components/CatalogFilters";
import { ProductGrid } from "@/components/ProductCard";
import {
  getBrands,
  getCatalogProducts,
  getCategories,
  getMarkets,
  getProductTypes,
} from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Catálogo",
  description:
    "Catálogo completo de productos de riego Sure Rain. Filtrá por categoría, marca, mercado y tipo.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = {
    q: typeof sp.q === "string" ? sp.q : undefined,
    category: typeof sp.categoria === "string" ? sp.categoria : undefined,
    brand: typeof sp.marca === "string" ? sp.marca : undefined,
    market: typeof sp.mercado === "string" ? sp.mercado : undefined,
    type: typeof sp.tipo === "string" ? sp.tipo : undefined,
  };

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

  return (
    <div className="container-sr py-10 sm:py-14">
      <div className="mb-8 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sr-green">
          Productos
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-sr-ink sm:text-4xl">
          Catálogo completo
        </h1>
        <p className="mt-3 text-sr-ink/60">
          Consultá el inventario publicado. Filtrá por categoría, marca, mercado
          o tipo, o buscá por nombre.
        </p>
      </div>

      {errorMessage ? (
        <div className="surface border-red-200 bg-red-50/70 px-5 py-6 text-sm text-red-800">
          {errorMessage}
        </div>
      ) : (
        <div className="space-y-6">
          <Suspense fallback={<div className="surface h-40 animate-pulse" />}>
            <CatalogFilters
              categories={categories}
              brands={brands}
              markets={markets}
              types={types}
              total={products.length}
            />
          </Suspense>
          <ProductGrid
            products={products}
            emptyMessage="Ningún producto coincide con los filtros."
          />
        </div>
      )}
    </div>
  );
}
