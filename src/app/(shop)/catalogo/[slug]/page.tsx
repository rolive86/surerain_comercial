import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { getProductBySlug } from "@/lib/catalog";
import { getCommercialSession } from "@/lib/commercial/session";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await getProductBySlug(slug);
    if (!product) return { title: "Producto no encontrado" };
    return {
      title: product.name,
      description:
        product.short_description?.slice(0, 160) ||
        `Ficha t├®cnica de ${product.name} en el cat├ílogo Sure Rain.`,
    };
  } catch {
    return { title: "Producto" };
  }
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const session = await getCommercialSession();
  let product: Awaited<ReturnType<typeof getProductBySlug>> = null;
  try {
    product = await getProductBySlug(slug);
  } catch {
    throw new Error("No se pudo cargar el producto desde Supabase.");
  }
  if (!product) notFound();

  const gallery = product.gallery.filter((g) => g.url);
  const specs = product.attributes.filter(
    (a) => a.slug !== "caracteristica" && a.value_text,
  );
  const features = product.attributes.filter(
    (a) => a.slug === "caracteristica" && a.value_text,
  );

  return (
    <div className="container-sr py-10 sm:py-14">
      <nav className="mb-6 text-sm text-sr-ink/50">
        <Link href="/catalogo" className="hover:text-sr-green">
          Cat├ílogo
        </Link>
        {product.category_slug ? (
          <>
            <span className="mx-2">/</span>
            <Link
              href={`/catalogo?categoria=${product.category_slug}`}
              className="hover:text-sr-green"
            >
              {product.category_name}
            </Link>
          </>
        ) : null}
        <span className="mx-2">/</span>
        <span className="text-sr-ink/80">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div className="space-y-4">
          <div className="surface relative aspect-[4/3] overflow-hidden">
            {product.image?.url ? (
              <Image
                src={product.image.url}
                alt={product.image.alt_text || product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-sr-mist text-sr-green/40">
                Sin imagen
              </div>
            )}
          </div>
          {gallery.length > 1 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {gallery.map((item) => (
                <div
                  key={`${item.id}-${item.role}`}
                  className="surface relative aspect-square overflow-hidden"
                >
                  {item.url ? (
                    <Image
                      src={item.url}
                      alt={item.alt_text || product.name}
                      fill
                      sizes="120px"
                      className="object-cover"
                    />
                  ) : null}
                  {item.role === "technical" ? (
                    <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Ficha
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            {product.category_name ? (
              <span className="chip">{product.category_name}</span>
            ) : null}
            {product.type_name ? (
              <span className="chip bg-white">{product.type_name}</span>
            ) : null}
            {product.markets.map((m) => (
              <span key={m.slug} className="chip bg-sr-green/10 text-sr-green-dark">
                {m.name}
              </span>
            ))}
          </div>

          <h1 className="mt-4 font-display text-3xl font-bold text-sr-ink sm:text-4xl">
            {product.name}
          </h1>
          {product.brand_name ? (
            <p className="mt-2 text-base text-sr-ink/55">{product.brand_name}</p>
          ) : null}

          <div className="mt-6">
            <AddToCartButton
              productSourceId={product.source_id}
              productName={product.name}
              productSlug={product.slug}
              authenticated={Boolean(session)}
            />
          </div>

          {product.description?.trim() ? (
            <div className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-sr-ink/45">
                Descripci├│n
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-sr-ink/75 sm:text-base">
                {product.description}
              </p>
            </div>
          ) : null}

          {features.length ? (
            <div className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-sr-ink/45">
                Caracter├¡sticas
              </h2>
              <ul className="mt-3 space-y-2">
                {features.map((f, idx) => (
                  <li
                    key={`${f.slug}-${idx}`}
                    className="flex gap-2 text-sm text-sr-ink/75"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sr-green" />
                    <span>{f.value_text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {specs.length ? (
            <div className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-sr-ink/45">
                Especificaciones
              </h2>
              <dl className="mt-3 divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white/70">
                {specs.map((s, idx) => (
                  <div
                    key={`${s.slug}-${idx}`}
                    className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm"
                  >
                    <dt className="text-sr-ink/50">{s.name}</dt>
                    <dd className="text-right font-medium text-sr-ink">
                      {s.value_text}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {product.documents.length ? (
            <div className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-sr-ink/45">
                Documentos
              </h2>
              <ul className="mt-3 space-y-2">
                {product.documents.map((doc) => (
                  <li key={doc.id}>
                    <a
                      href={doc.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary w-full justify-between sm:w-auto"
                    >
                      <span>{doc.name}</span>
                      <span className="text-xs uppercase opacity-60">
                        {doc.document_type.replace("_", " ")}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
