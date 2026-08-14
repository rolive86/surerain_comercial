import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCustomerOrderDetail } from "@/lib/commercial/orders";
import { getCommercialSession } from "@/lib/commercial/session";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const order = await getCustomerOrderDetail(id);
    if (!order) return { title: "Pedido" };
    return {
      title: `Pedido ${order.order_number}`,
      description: `Detalle e historial del pedido ${order.order_number}.`,
    };
  } catch {
    return { title: "Pedido" };
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR");
}

export default async function PedidoPage({ params }: { params: Params }) {
  const session = await getCommercialSession();
  if (!session) redirect("/login?next=/mis-pedidos");
  if (session.claims.app_role !== "customer_user") {
    redirect("/cuenta?error=orders_customer_only");
  }

  const { id } = await params;
  const order = await getCustomerOrderDetail(id);
  if (!order) notFound();

  return (
    <div className="container-sr py-12">
      <nav className="mb-6 text-sm text-sr-ink/50">
        <Link href="/mis-pedidos" className="hover:text-sr-green">
          Mis pedidos
        </Link>
        <span className="mx-2">/</span>
        <span className="text-sr-ink/80">{order.order_number}</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sr-green">
            Detalle de pedido
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-sr-green sm:text-4xl">
            {order.order_number}
          </h1>
          <p className="mt-2 text-sm text-sr-ink/60">
            <span className="chip">{order.status_label}</span>
            <span className="ml-2">
              Enviado: {formatDate(order.submitted_at ?? order.created_at)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/mis-pedidos" className="btn-secondary">
            Volver al listado
          </Link>
          <Link href="/catalogo" className="btn-primary">
            Seguir comprando
          </Link>
        </div>
      </div>

      <section className="surface mt-8 p-6">
        <h2 className="font-display text-xl font-semibold">Ítems</h2>
        {order.items.length === 0 ? (
          <p className="mt-4 text-sm text-sr-ink/55">Sin ítems.</p>
        ) : (
          <ul className="mt-4 divide-y divide-black/5">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-4 py-3">
                <div>
                  {item.product_slug_snapshot ? (
                    <Link
                      href={`/catalogo/${item.product_slug_snapshot}`}
                      className="font-medium hover:text-sr-green"
                    >
                      {item.product_name_snapshot}
                    </Link>
                  ) : (
                    <p className="font-medium">{item.product_name_snapshot}</p>
                  )}
                  <p className="font-mono text-xs text-sr-ink/45">{item.product_source_id}</p>
                </div>
                <p className="text-sm font-semibold">× {item.quantity}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {order.customer_notes.length ? (
        <section className="surface mt-4 p-6">
          <h2 className="font-display text-xl font-semibold">Tus notas</h2>
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
        <h2 className="font-display text-xl font-semibold">Historial de estado</h2>
        {order.history.length === 0 ? (
          <p className="mt-4 text-sm text-sr-ink/55">Sin historial.</p>
        ) : (
          <ol className="mt-4 space-y-3 border-l border-sr-green/20 pl-4">
            {order.history.map((h) => (
              <li key={h.id} className="relative text-sm text-sr-ink/70">
                <span className="absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full bg-sr-green" />
                <p>
                  <span className="font-semibold text-sr-ink">{h.to_status_label}</span>
                  {h.from_status ? (
                    <span className="text-sr-ink/40"> ← {h.from_status}</span>
                  ) : null}
                </p>
                <p className="text-xs text-sr-ink/40">{formatDate(h.created_at)}</p>
                {h.comment ? <p className="mt-1 text-sr-ink/55">{h.comment}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
