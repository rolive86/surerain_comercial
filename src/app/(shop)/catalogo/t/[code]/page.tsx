import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { getTangoProductByCode, getTangoProducts } from "@/lib/commercial/products-tango";
import { isCustomerRole } from "@/lib/commercial/roles";
import { getCommercialSession } from "@/lib/commercial/session";
import { ProductRail } from "@/components/ProductRail";

export const dynamic = "force-dynamic";

type Params = Promise<{ code: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);
  try {
    const product = await getTangoProductByCode(code);
    if (!product) return { title: "Artículo no encontrado" };
    return {
      title: product.name,
      description: `Artículo Tango ${product.tangoCode ?? code}`,
    };
  } catch {
    return { title: "Artículo" };
  }
}

export default async function TangoProductPage({ params }: { params: Params }) {
  const session = await getCommercialSession();
  if (!isCustomerRole(session?.claims.app_role)) {
    redirect("/login?next=/catalogo");
  }

  const { code: raw } = await params;
  const code = decodeURIComponent(raw);
  const product = await getTangoProductByCode(code);
  if (!product) notFound();

  let related: Awaited<ReturnType<typeof getTangoProducts>> = [];
  if (product.category_name) {
    related = await getTangoProducts({ familia: product.category_name });
    related = related.filter((p) => p.source_id !== product.source_id).slice(0, 8);
  }

  return (
    <div className="container-sr py-8 sm:py-12">
      <nav className="mb-6 text-sm text-sr-ink/50">
        <Link href="/catalogo" className="hover:text-sr-green">
          Catálogo
        </Link>
        <span className="mx-2">/</span>
        <span className="text-sr-ink/70">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-sr-mist">
          {product.image?.url ? (
            <Image
              src={product.image.url}
              alt={product.image.alt_text || product.name}
              fill
              className="object-contain p-6"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#e8f0ea] via-white to-[#f3f7f4]">
              <span className="font-display text-3xl font-bold text-sr-green/60">
                Sure Rain
              </span>
              <span className="max-w-xs px-4 text-center text-sm text-sr-ink/40">
                {product.name}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-5">
          {product.category_name ? (
            <span className="chip-vertical">{product.category_name}</span>
          ) : null}
          <h1 className="font-display text-3xl font-bold text-sr-ink sm:text-4xl">
            {product.name}
          </h1>
          <p className="font-mono text-sm text-sr-ink/50">{product.tangoCode}</p>

          {product.hasStock ? (
            <span className="inline-block rounded bg-sr-green/10 px-2 py-1 text-xs font-semibold text-sr-green">
              Con stock
              {product.stockQty != null ? ` · ${product.stockQty}` : ""}
            </span>
          ) : null}

          <p className="text-sm text-sr-ink/60">
            El precio se confirma en la cotización que te envía tu vendedor (PDF).
          </p>

          {product.attributes.length ? (
            <dl className="space-y-2 border-t border-sr-ink/10 pt-4 text-sm">
              {product.attributes
                .filter((a) => a.slug !== "precio")
                .map((a) => (
                  <div key={a.slug} className="flex justify-between gap-4">
                    <dt className="text-sr-ink/50">{a.name}</dt>
                    <dd className="font-medium text-sr-ink">{a.value_text}</dd>
                  </div>
                ))}
            </dl>
          ) : null}

          <AddToCartButton
            productSourceId={product.source_id}
            productName={product.name}
            productSlug={product.slug}
            authenticated
            withStepper
          />
        </div>
      </div>

      {related.length ? (
        <div className="mt-14">
          <ProductRail title="Misma familia" products={related} authenticated />
        </div>
      ) : null}
    </div>
  );
}
