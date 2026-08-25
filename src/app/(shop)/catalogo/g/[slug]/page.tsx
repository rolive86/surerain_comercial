import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { VariantProductPanel } from "@/components/VariantProductPanel";
import { getProductGroupBySlug } from "@/lib/commercial/product-groups";
import { getStockAvailabilityMany } from "@/lib/commercial/stock";
import { isCustomerRole, isStaffRole } from "@/lib/commercial/roles";
import { getCommercialSession } from "@/lib/commercial/session";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type Search = Promise<{ v?: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  try {
    const group = await getProductGroupBySlug(slug);
    if (!group) return { title: "Producto no encontrado" };
    return {
      title: group.name,
      description: `${group.variants.length} medidas · ${group.familia ?? "Tango"}`,
    };
  } catch {
    return { title: "Producto" };
  }
}

export default async function GroupProductPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const session = await getCommercialSession();
  const role = session?.claims.app_role;
  if (!isCustomerRole(role) && !isStaffRole(role)) {
    redirect("/login?next=/catalogo");
  }
  const staffMode = isStaffRole(role);

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const sp = await searchParams;
  const group = await getProductGroupBySlug(slug);
  if (!group || group.variants.length === 0) notFound();

  // Grupo de 1: ir a ficha simple del código
  if (group.variants.length === 1) {
    redirect(`/catalogo/t/${encodeURIComponent(group.variants[0].cod_articulo)}`);
  }

  const stockMap = staffMode
    ? await getStockAvailabilityMany(group.variants.map((v) => v.cod_articulo))
    : new Map();

  const stockByCode: Record<
    string,
    { cod_articulo: string; stock_real: number; comprometido: number; libre: number }
  > = {};
  for (const [k, v] of stockMap) {
    stockByCode[k] = v;
  }

  return (
    <div className="container-sr py-8 sm:py-12">
      <nav className="mb-6 text-sm text-sr-ink/50">
        <Link href="/catalogo" className="hover:text-sr-green">
          Catálogo
        </Link>
        <span className="mx-2">/</span>
        <span className="text-sr-ink/70">{group.name}</span>
      </nav>

      <VariantProductPanel
        groupName={group.name}
        familia={group.familia}
        slug={group.slug ?? slug}
        variants={group.variants.map((v) => ({
          cod_articulo: v.cod_articulo,
          variant_label: v.variant_label,
          descripcion: v.descripcion ?? null,
          image_url: v.image_url ?? null,
          has_stock: Boolean(v.has_stock),
          has_price: Boolean(v.has_price),
          stock_qty: v.stock_qty ?? null,
        }))}
        initialCode={typeof sp.v === "string" ? sp.v : null}
        staffMode={staffMode}
        stockByCode={stockByCode}
      />
    </div>
  );
}
