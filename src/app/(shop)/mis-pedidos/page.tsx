import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { orderStatusClass } from "@/components/OrderTimeline";
import {
  listActiveOrderStatuses,
  listCustomerOrders,
} from "@/lib/commercial/orders";
import { getCommercialSession } from "@/lib/commercial/session";
import { getProductThumbnailsBySourceIds } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Mis compras",
  description: "Historial de pedidos B2B Sure Rain.",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR");
}

export default async function MisPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const session = await getCommercialSession();
  if (!session) redirect("/login?next=/mis-pedidos");
  if (session.claims.app_role !== "customer_user") {
    redirect("/cuenta?error=orders_customer_only");
  }

  const params = await searchParams;
  const statusFilter = params.estado?.trim() || undefined;
  const q = params.q?.trim() || undefined;

  const [orders, statuses] = await Promise.all([
    listCustomerOrders({ status: statusFilter, q }),
    listActiveOrderStatuses(),
  ]);

  const thumbs = await getProductThumbnailsBySourceIds(
    orders.flatMap((o) => o.preview_items.map((i) => i.product_source_id)),
  );

  return (
    <div className="container-sr py-10 sm:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sr-green">
            Portal de pedidos
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-sr-ink sm:text-4xl">
            Mis compras
          </h1>
          <p className="mt-2 text-sm text-sr-ink/60">
            Pedidos de tu empresa. El precio queda congelado al confirmar.
          </p>
        </div>
        <Link href="/carrito" className="btn-secondary">
          Ir al pedido
        </Link>
      </div>

      <form className="mt-6" action="/mis-pedidos" method="get">
        {statusFilter ? (
          <input type="hidden" name="estado" value={statusFilter} />
        ) : null}
        <label className="sr-only" htmlFor="order-search">
          Buscar por número
        </label>
        <input
          id="order-search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por número…"
          className="h-11 w-full max-w-md rounded-xl border border-black/10 bg-white px-3 text-sm outline-none ring-sr-green/30 focus:ring-2"
        />
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <FilterChip href="/mis-pedidos" active={!statusFilter} label="Todos" />
        {statuses.map((s) => (
          <FilterChip
            key={s.code}
            href={`/mis-pedidos?estado=${encodeURIComponent(s.code)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            active={statusFilter === s.code}
            label={s.label}
            status={s.code}
          />
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="surface mt-8 px-6 py-16 text-center">
          <p className="font-display text-xl text-sr-ink/70">
            {statusFilter || q ? "No hay pedidos con ese criterio." : "Todavía no tenés compras."}
          </p>
          <Link href="/catalogo" className="btn-primary mt-6 inline-flex">
            Ir al catálogo
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/pedido/${order.id}`}
                className="surface flex flex-col gap-3 p-4 transition hover:shadow-card-hover sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-sr-ink">
                    {order.order_number}
                  </p>
                  <p className="mt-1 text-sm text-sr-ink/55">
                    {formatDate(order.submitted_at ?? order.created_at)} · {order.item_count}{" "}
                    producto(s)
                  </p>
                  <div className="mt-2 flex gap-1">
                    {order.preview_items.map((item) => {
                      const thumb = thumbs.get(item.product_source_id);
                      return (
                        <span
                          key={item.product_source_id}
                          className="relative h-10 w-10 overflow-hidden rounded-md bg-sr-mist"
                        >
                          {thumb?.url ? (
                            <Image
                              src={thumb.url}
                              alt={item.product_name_snapshot}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <span className={`chip w-fit ${orderStatusClass(order.status)}`}>
                  {order.status_label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  href,
  label,
  active,
  status,
}: {
  href: string;
  label: string;
  active: boolean;
  status?: string;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? `chip min-h-11 px-3 ${status ? orderStatusClass(status) : "bg-sr-green text-white"}`
          : "chip min-h-11 bg-white px-3 text-sr-ink/70"
      }
    >
      {label}
    </Link>
  );
}
