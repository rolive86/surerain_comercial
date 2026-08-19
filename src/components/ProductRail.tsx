import Image from "next/image";
import Link from "next/link";
import { AddToCartButton } from "@/components/AddToCartButton";
import type { ProductListItem } from "@/lib/catalog";
import type { ReorderCandidate } from "@/lib/recommendations";
import { daysAgoLabel } from "@/lib/recommendations";
import { formatFinalUsd } from "@/lib/commercial/money";

export function RailSkeleton() {
  return (
    <div className="rail">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton h-56 w-44 rounded-2xl" />
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
    <article className="surface flex w-44 flex-col overflow-hidden shadow-card sm:w-52">
      <Link href={`/catalogo/${product.slug}`} className="relative block aspect-[4/3] bg-sr-mist">
        {product.image?.url ? (
          <Image
            src={product.image.url}
            alt={product.image.alt_text || product.name}
            fill
            sizes="208px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center px-2 text-center text-[11px] font-semibold text-sr-green/45">
            {product.name.slice(0, 22)}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        {product.brand_name ? (
          <span className="chip-brand w-fit">{product.brand_name}</span>
        ) : null}
        <Link
          href={`/catalogo/${product.slug}`}
          className="line-clamp-2 font-display text-sm font-semibold leading-snug text-sr-ink hover:text-sr-green"
        >
          {product.name}
        </Link>
        {product.tangoCode ? (
          <p className="font-mono text-[11px] text-sr-ink/45">{product.tangoCode}</p>
        ) : null}
        {authenticated ? (
          <p className="text-xs font-semibold text-sr-green">
            {product.finalPrice ? formatFinalUsd(product.finalPrice.amount) : "A confirmar"}
          </p>
        ) : null}
        {extra}
        <AddToCartButton
          productSourceId={product.source_id}
          productName={product.name}
          productSlug={product.slug}
          authenticated={authenticated}
          compact
        />
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
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-semibold text-sr-ink">{title}</h2>
        {subtitle ? <p className="text-sm text-sr-ink/50">{subtitle}</p> : null}
      </div>
      <div className="rail">
        {products.map((p) => (
          <CardShell key={p.id} product={p} authenticated={authenticated} />
        ))}
      </div>
    </section>
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
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-semibold text-sr-ink">Volvé a pedir</h2>
        <p className="text-sm text-sr-ink/50">Según tu cadencia de pedidos</p>
      </div>
      <div className="rail">
        {items.map((p) => (
          <CardShell
            key={p.id}
            product={p}
            authenticated={authenticated}
            extra={
              <p className="text-[11px] text-sr-ink/45">
                Última vez hace {daysAgoLabel(p.lastOrderedAt)} día(s)
              </p>
            }
          />
        ))}
      </div>
    </section>
  );
}
