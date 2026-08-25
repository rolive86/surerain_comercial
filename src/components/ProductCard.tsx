import Image from "next/image";
import Link from "next/link";
import { AddToCartButton } from "@/components/AddToCartButton";
import { CustomerStockBadge, StaffStockLine } from "@/components/StockBadges";
import type { ProductListItem } from "@/lib/catalog";
import type { StockAvailability } from "@/lib/commercial/stock";

function BrandPlaceholder({ name }: { name: string }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#e8f0ea] via-white to-[#f3f7f4] px-3 text-center">
      <span className="font-display text-lg font-bold tracking-wide text-sr-green/70">
        Sure Rain
      </span>
      <span className="line-clamp-2 text-xs font-medium text-sr-ink/40">
        {name.slice(0, 48)}
      </span>
    </div>
  );
}

export function ProductCard({
  product,
  authenticated = false,
  staffStock = false,
  stock = null,
}: {
  product: ProductListItem;
  authenticated?: boolean;
  staffStock?: boolean;
  stock?: StockAvailability | null;
}) {
  const href = `/catalogo/${product.slug}`;

  return (
    <article className="surface group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-sr-green/20 hover:shadow-card-hover">
      <Link href={href} className="relative aspect-[4/3] overflow-hidden bg-sr-mist">
        {product.image?.url ? (
          <Image
            src={product.image.url}
            alt={product.image.alt_text || product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <BrandPlaceholder name={product.name} />
        )}
        {authenticated && !staffStock ? (
          <span className="absolute left-2 top-2">
            <CustomerStockBadge hasStock={Boolean(product.hasStock)} />
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1">
          {product.category_name ? (
            <span className="chip-vertical">{product.category_name}</span>
          ) : null}
          {product.brand_name ? (
            <span className="chip-brand">{product.brand_name}</span>
          ) : null}
        </div>
        <Link href={href}>
          <h3 className="font-display text-sm font-semibold leading-snug text-sr-ink sm:text-base group-hover:text-sr-green">
            {product.name}
          </h3>
        </Link>
        {product.tangoCode ? (
          <p className="font-mono text-[11px] text-sr-ink/45">{product.tangoCode}</p>
        ) : null}
        {product.isVariantGroup && (product.variantCount ?? 0) > 1 ? (
          <p className="text-xs font-medium text-sr-green">
            {product.variantCount} medidas disponibles
          </p>
        ) : null}
        {staffStock && stock && !product.isVariantGroup ? (
          <StaffStockLine
            stockReal={stock.stock_real}
            comprometido={stock.comprometido}
            libre={stock.libre}
            compact
          />
        ) : null}
        {!staffStock && !product.isVariantGroup ? (
          <div className="mt-auto pt-1">
            <AddToCartButton
              productSourceId={product.source_id}
              productName={product.name}
              productSlug={product.slug}
              authenticated={authenticated}
              compact
              withStepper
            />
          </div>
        ) : product.isVariantGroup ? (
          <div className="mt-auto pt-1">
            <Link href={href} className="btn-secondary !min-h-10 w-full text-center text-xs">
              Elegir medida
            </Link>
          </div>
        ) : (
          <div className="mt-auto pt-1" />
        )}
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  emptyMessage = "No hay productos para mostrar.",
  authenticated = false,
  staffStock = false,
  stockByCode,
}: {
  products: ProductListItem[];
  emptyMessage?: string;
  authenticated?: boolean;
  staffStock?: boolean;
  stockByCode?: Map<string, StockAvailability>;
}) {
  if (!products.length) {
    return (
      <div className="surface px-6 py-16 text-center">
        <p className="font-display text-xl text-sr-ink/70">{emptyMessage}</p>
        <p className="mt-2 text-sm text-sr-ink/45">
          Probá limpiar los filtros o buscar otro término.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          authenticated={authenticated}
          staffStock={staffStock}
          stock={
            stockByCode?.get(product.tangoCode ?? product.source_id) ?? null
          }
        />
      ))}
    </div>
  );
}
