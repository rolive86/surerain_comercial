import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderTimeline, orderStatusClass } from "@/components/OrderTimeline";
import { reorderOrderAction } from "@/lib/commercial/cart-actions";
import { getCustomerOrderDetail } from "@/lib/commercial/orders";
import { getCommercialSession } from "@/lib/commercial/session";
import { getProductCodesBySourceIds } from "@/lib/commercial/product-codes";
import { getProductThumbnailsBySourceIds } from "@/lib/catalog";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const order = await getCustomerOrderDetail(id);
    if (!order) return { title: "Cotización" };
    return {
      title: `Cotización ${order.order_number}`,
      description: `Detalle de la solicitud ${order.order_number}.`,
    };
  } catch {
    return { title: "Cotización" };
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR");
}

export default async function PedidoPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getCommercialSession();
  if (!session) redirect("/login?next=/mis-pedidos");
  if (session.claims.app_role !== "customer_user") {
    redirect("/cuenta?error=orders_customer_only");
  }

  const { id } = await params;
  const flash = await searchParams;
  const order = await getCustomerOrderDetail(id);
  if (!order) notFound();

  const sourceIds = order.items.map((i) => i.product_source_id);
  const [thumbs, codes] = await Promise.all([
    getProductThumbnailsBySourceIds(sourceIds),
    getProductCodesBySourceIds(sourceIds),
  ]);

  return (
    <div className="container-sr py-10 sm:py-12">
      <nav className="mb-6 text-sm text-sr-ink/50">
        <Link href="/mis-pedidos" className="hover:text-sr-green">
          Mis cotizaciones
        </Link>
        <span className="mx-2">/</span>
        <span className="text-sr-ink/80">{order.order_number}</span>
      </nav>

      {flash.error ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{flash.error}</p>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-sr-ink sm:text-4xl">
            {order.order_number}
          </h1>
          <p className="mt-2 text-sm text-sr-ink/60">
            <span className={`chip ${orderStatusClass(order.status)}`}>{order.status_label}</span>
            <span className="ml-2">
              Enviada: {formatDate(order.submitted_at ?? order.created_at)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.status === "sent" && order.pdf_url ? (
            <a
              href={order.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              Ver mi cotización (PDF)
            </a>
          ) : null}
          <form action={reorderOrderAction}>
            <input type="hidden" name="order_id" value={order.id} />
            <button type="submit" className="btn-secondary">
              Volver a solicitar
            </button>
          </form>
        </div>
      </div>

      <section className="surface mt-8 p-6">
        <h2 className="font-display text-xl font-semibold">Artículos</h2>
        <ul className="mt-4 divide-y divide-black/5">
          {order.items.map((item) => {
            const thumb = thumbs.get(item.product_source_id);
            const href = item.product_slug_snapshot
              ? `/catalogo/${item.product_slug_snapshot}`
              : "/catalogo";
            return (
              <li key={item.id} className="flex items-center gap-3 py-3">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-sr-mist">
                  {thumb?.url ? (
                    <Image
                      src={thumb.url}
                      alt={item.product_name_snapshot}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={href} className="font-medium hover:text-sr-green">
                    {item.product_name_snapshot}
                  </Link>
                  {item.sku_snapshot || codes.get(item.product_source_id) ? (
                    <p className="font-mono text-xs text-sr-ink/50">
                      {item.sku_snapshot || codes.get(item.product_source_id)}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">× {item.quantity}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-sm text-sr-ink/55">
          Los precios se confirman en el PDF de cotización.
        </p>
      </section>

      {order.customer_notes.length ? (
        <section className="surface mt-4 p-6">
          <h2 className="font-display text-xl font-semibold">Observaciones</h2>
          <ul className="mt-4 space-y-3">
            {order.customer_notes.map((n) => (
              <li key={n.id} className="rounded-md bg-sr-mist/50 px-3 py-2 text-sm text-sr-ink/75">
                <p>{n.body}</p>
                <p className="mt-1 text-xs text-sr-ink/40">{formatDate(n.created_at)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="surface mt-4 p-6">
        <h2 className="font-display text-xl font-semibold">Seguimiento</h2>
        <OrderTimeline history={order.history} />
      </section>
    </div>
  );
}
