import Link from "next/link";
import {
  getCategories,
  getCatalogStats,
  getFeaturedProducts,
} from "@/lib/catalog";
import { ProductGrid } from "@/components/ProductCard";
import { EmptyState, ProductRail, ReorderRail } from "@/components/ProductRail";
import { getCommercialSession } from "@/lib/commercial/session";
import { getGreetingName } from "@/lib/commercial/profile";
import { getDashboardRecommendations } from "@/lib/recommendations";
import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { withProductCodes } from "@/lib/commercial/product-codes";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getCommercialSession();
  const isCustomer = session?.claims.app_role === "customer_user";

  if (session && isCustomer) {
    return <CustomerDashboard email={session.user.email} customerId={session.claims.customer_id} />;
  }

  return <PublicHome signedIn={Boolean(session)} />;
}

async function CustomerDashboard({
  email,
  customerId,
}: {
  email: string | null;
  customerId: string | null;
}) {
  const [name, recs, company] = await Promise.all([
    getGreetingName(email),
    getDashboardRecommendations(),
    loadCompanyLabel(customerId),
  ]);
  const [reorder, habitual, recommended] = await Promise.all([
    withProductCodes(recs.reorder),
    withProductCodes(recs.habitual),
    withProductCodes(recs.recommended),
  ]);

  const hasAny = recs.reorder.length + recs.habitual.length + recs.recommended.length > 0;

  return (
    <div className="container-sr space-y-10 py-8 sm:py-12">
      <section>
        <h1 className="font-display text-3xl font-bold text-sr-ink sm:text-4xl">
          Hola, {name} 👋
        </h1>
        <p className="mt-1 text-sm text-sr-ink/55">{company}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/catalogo" className="btn-primary">
            Catálogo
          </Link>
          <Link href="/mis-pedidos" className="btn-secondary">
            Mis cotizaciones
          </Link>
          <Link href="/carrito" className="btn-secondary">
            Mi solicitud
          </Link>
        </div>
      </section>

      {!hasAny ? (
        <EmptyState
          title="Todavía no hay historial. Empezá por el catálogo."
          ctaHref="/catalogo"
          ctaLabel="Ver catálogo"
        />
      ) : (
        <>
          <ReorderRail items={reorder} authenticated />
          <ProductRail
            title="Tus productos habituales"
            products={habitual}
            authenticated
          />
          <ProductRail
            title="Recomendados para vos"
            subtitle={recs.coldStart ? "Destacados del catálogo" : undefined}
            products={recommended}
            authenticated
          />
        </>
      )}
    </div>
  );
}

async function loadCompanyLabel(customerId: string | null): Promise<string> {
  if (!customerId) return "—";
  const supabase = await createCommercialServerClient();
  const { data } = await supabase
    .from("customers")
    .select("legal_name, trade_name")
    .eq("id", customerId)
    .maybeSingle();
  return data?.trade_name || data?.legal_name || "—";
}

async function PublicHome({ signedIn }: { signedIn: boolean }) {
  let categories: Awaited<ReturnType<typeof getCategories>> = [];
  let featured: Awaited<ReturnType<typeof getFeaturedProducts>> = [];
  let stats = { products: 0, categories: 0, brands: 0 };
  let errorMessage: string | null = null;

  try {
    [categories, featured, stats] = await Promise.all([
      getCategories(),
      getFeaturedProducts(8),
      getCatalogStats(),
    ]);
  } catch (err) {
    errorMessage =
      err instanceof Error ? err.message : "No se pudo cargar el catálogo.";
  }

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(0,106,70,0.18),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(20,32,26,0.08),transparent_40%)]" />
        <div className="container-sr grid min-h-[72vh] items-center gap-10 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-sr-green">
              Sure Rain
            </p>
            <h1 className="font-display max-w-xl text-4xl font-bold leading-[1.05] text-sr-ink sm:text-5xl lg:text-6xl">
              Catálogo técnico de riego, listo para consultar.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-sr-ink/65 sm:text-lg">
              {stats.products} productos en {stats.categories} categorías y{" "}
              {stats.brands} marcas. Filtrá por mercado, tipo y marca sin salir
              del catálogo.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/catalogo" className="btn-primary">
                Ver catálogo completo
              </Link>
              {signedIn ? (
                <Link href="/cuenta" className="btn-secondary">
                  Mi cuenta
                </Link>
              ) : (
                <Link href="/login" className="btn-secondary">
                  Ingresar al portal
                </Link>
              )}
            </div>
          </div>
          <div className="surface relative overflow-hidden p-6 sm:p-8">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-sr-green/10" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sr-ink/40">
              Inventario publicado
            </p>
            <dl className="mt-6 grid grid-cols-3 gap-4">
              <Stat label="Productos" value={stats.products} />
              <Stat label="Categorías" value={stats.categories} />
              <Stat label="Marcas" value={stats.brands} />
            </dl>
            <p className="mt-8 text-sm leading-relaxed text-sr-ink/55">
              Contenido sincronizado desde Supabase. Sin precios inventados ni
              stock ficticio.
            </p>
          </div>
        </div>
      </section>

      <section className="container-sr pb-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-sr-ink">
              Categorías
            </h2>
            <p className="mt-1 text-sm text-sr-ink/55">
              Acceso directo a las líneas principales del catálogo.
            </p>
          </div>
        </div>
        {errorMessage ? (
          <ErrorBox message={errorMessage} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/catalogo?categoria=${cat.slug}`}
                className="surface px-4 py-5 transition hover:border-sr-green/25 hover:shadow-card"
              >
                <span className="font-display text-lg font-semibold text-sr-ink">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="container-sr pb-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-sr-ink">
              Destacados del catálogo
            </h2>
            <p className="mt-1 text-sm text-sr-ink/55">
              Una muestra de productos publicados.
            </p>
          </div>
          <Link
            href="/catalogo"
            className="text-sm font-semibold text-sr-green hover:text-sr-green-dark"
          >
            Ver todos
          </Link>
        </div>
        {errorMessage ? (
          <ErrorBox message={errorMessage} />
        ) : (
          <ProductGrid products={await withProductCodes(featured)} />
        )}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-sr-ink/40">{label}</dt>
      <dd className="mt-1 font-display text-3xl font-bold text-sr-green">{value}</dd>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="surface border-red-200 bg-red-50/70 px-5 py-6 text-sm text-red-800">
      No se pudo conectar con Supabase: {message}
    </div>
  );
}
