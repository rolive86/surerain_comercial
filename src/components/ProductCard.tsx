import Image from "next/image";
import Link from "next/link";
import type { ProductListItem } from "@/lib/catalog";

function FallbackImage({ name }: { name: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sr-mist to-white text-sm font-semibold text-sr-green/50">
      {name.slice(0, 24)}
    </div>
  );
}

export function ProductCard({ product }: { product: ProductListItem }) {
  return (
    <Link
      href={`/catalogo/${product.slug}`}
      className="surface group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-sr-green/20"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-sr-mist">
        {product.image?.url ? (
          <Image
            src={product.image.url}
            alt={product.image.alt_text || product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <FallbackImage name={product.name} />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-1.5">
          {product.category_name ? (
            <span className="chip">{product.category_name}</span>
          ) : null}
          {product.type_name ? (
            <span className="chip bg-white text-sr-ink/70">{product.type_name}</span>
          ) : null}
        </div>
        <h3 className="font-display text-lg font-semibold leading-snug text-sr-ink group-hover:text-sr-green">
          {product.name}
        </h3>
        {product.brand_name ? (
          <p className="text-sm text-sr-ink/55">{product.brand_name}</p>
        ) : null}
      </div>
    </Link>
  );
}

export function ProductGrid({
  products,
  emptyMessage = "No hay productos para mostrar.",
}: {
  products: ProductListItem[];
  emptyMessage?: string;
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
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
