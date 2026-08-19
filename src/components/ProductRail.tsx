import Image from "next/image";
import Link from "next/link";
import { AddToCartButton } from "@/components/AddToCartButton";
import { HorizontalRail } from "@/components/HorizontalRail";
import type { ProductListItem } from "@/lib/catalog";
import type { ReorderCandidate } from "@/lib/recommendations";
import { daysAgoLabel } from "@/lib/recommendations";
import { displayFinalUsd } from "@/lib/commercial/money";

const railCardWidth =
  "w-[calc((100%-1rem)/2)] sm:w-[calc((100%-1.85rem)/3)] lg:w-[calc((100%-2.75rem)/4)] xl:w-[calc((100%-3.75rem)/5)]";

export function RailSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`skeleton h-56 shrink-0 rounded-2xl ${railCardWidth}`}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="surface px-5 py-8 text-center">
      <p className="text-sm text-sr-ink/55">{title}</p>
      <Link href={ctaHref} className="btn-primary mt-4 inline-flex">
        {ctaLabel}
      </Link>
    </div>
  );
}

function CardShell({
  product,
  authenticated,
  extra,
}: {
  product: ProductListItem;
  authenticated: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <article
      data-rail-card
      className={`surface flex h-full shrink-0 snap-start flex-col overflow-hidden shadow-card ${railCardWidth}`}
    >
      <Link href={`/catalogo/${product.slug}`} className="relative block aspect-[4/3] shrink-0 bg-sr-mist">
        {product.image?.url ? (
          <Image
            src={product.image.url}
            alt={product.image.alt_text || product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center px-2 text-center text-[11px] font-semibold text-sr-green/45">
            {product.name.slice(0, 22)}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-3">
        <span
          className={`chip-brand h-6 max-w-full overflow-hidden ${product.brand_name ? "" : "invisible"}`}
        >
          <span className="truncate">{product.brand_name || "Marca"}</span>
        </span>
        <Link
          href={`/catalogo/${product.slug}`}
          className="mt-2 line-clamp-2 min-h-10 font-display text-sm font-semibold leading-snug text-sr-ink hover:text-sr-green"
        >
          {product.name}
        </Link>
        <p className="mt-1 min-h-4 font-mono text-[11px] leading-4 text-sr-ink/45">
          {product.tangoCode || "\u00a0"}
        </p>
        {authenticated ? (
          <p className="mt-1 min-h-4 text-xs font-semibold leading-4 text-sr-green">
            {displayFinalUsd(product.finalPrice?.amount)}
          </p>
        ) : null}
        {extra ? <div className="mt-1 min-h-4">{extra}</div> : null}
        <div className="mt-auto pt-3">
          <AddToCartButton
            productSourceId={product.source_id}
            productName={product.name}
            productSlug={product.slug}
            authenticated={authenticated}
            compact
          />
        </div>
      </div>
    </article>
  );
}

export function ProductRail({
  title,
  subtitle,
  products,
  authenticated,
}: {
  title: string;
  subtitle?: string;
  products: ProductListItem[];
  authenticated: boolean;
}) {
  if (!products.length) return null;
  return (
    <HorizontalRail title={title} subtitle={subtitle}>
      {products.map((p) => (
        <CardShell key={p.id} product={p} authenticated={authenticated} />
      ))}
    </HorizontalRail>
  );
}

export function ReorderRail({
  items,
  authenticated,
}: {
  items: ReorderCandidate[];
  authenticated: boolean;
}) {
  if (!items.length) return null;
  return (
    <HorizontalRail title="Volvé a pedir" subtitle="Según tu cadencia de pedidos">
      {items.map((p) => (
        <CardShell
          key={p.id}
          product={p}
          authenticated={authenticated}
          extra={
            <p className="text-[11px] leading-4 text-sr-ink/45">
              Última vez hace {daysAgoLabel(p.lastOrderedAt)} día(s)
            </p>
          }
        />
      ))}
    </HorizontalRail>
  );
}
