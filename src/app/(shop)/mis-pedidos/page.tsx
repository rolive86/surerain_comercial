import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  listActiveOrderStatuses,
  listCustomerOrders,
} from "@/lib/commercial/orders";
import { getCommercialSession } from "@/lib/commercial/session";

export const metadata: Metadata = {
  title: "Mis pedidos",
  description: "Historial de pedidos B2B Sure Rain.",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR");
}

export default async function MisPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const session = await getCommercialSession();
  if (!session) redirect("/login?next=/mis-pedidos");
  if (session.claims.app_role !== "customer_user") {
    redirect("/cuenta?error=orders_customer_only");
  }

  const params = await searchParams;
  const statusFilter = params.estado?.trim() || undefined;

  const [orders, statuses] = await Promise.all([
    listCustomerOrders({ status: statusFilter }),
    listActiveOrderStatuses(),
  ]);

  return (
    <div className="container-sr py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sr-green">
            Portal B2B
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-sr-green sm:text-4xl">
            Mis pedidos
          </h1>
          <p className="mt-2 text-sm text-sr-ink/60">
            Pedidos de tu empresa (RLS). Sin precios inventados.
          </p>
        </div>
        <Link href="/carrito" className="btn-secondary">
          Ir al carrito
        </Link>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <FilterChip href="/mis-pedidos" active={!statusFilter} label="Todos" />
        {statuses.map((s) => (
          <FilterChip
            key={s.code}
            href={`/mis-pedidos?estado=${encodeURIComponent(s.code)}`}
            active={statusFilter === s.code}
            label={s.label}
          />
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="surface mt-8 px-6 py-16 text-center">
          <p className="font-display text-xl text-sr-ink/70">
            {statusFilter ? "No hay pedidos con ese estado." : "Todavía no tenés pedidos."}
          </p>
          <p className="mt-2 text-sm text-sr-ink/45">
            Confirmá un pedido desde el carrito para verlo acá.
          </p>
          <Link href="/catalogo" className="btn-primary mt-6 inline-flex">
            Ir al catálogo
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/pedido/${order.id}`}
                className="flex flex-col gap-2 px-4 py-4 transition hover:bg-sr-mist/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-display text-lg font-semibold text-sr-ink">
                    {order.order_number}
                  </p>
                  <p className="mt-1 text-sm text-sr-ink/55">
                    {formatDate(order.submitted_at ?? order.created_at)} · {order.item_count}{" "}
                    producto(s) · cant. {order.total_quantity}
                  </p>
                </div>
                <span className="chip w-fit">{order.status_label}</span>
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
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "chip bg-sr-green text-white"
          : "chip bg-white text-sr-ink/70 hover:border-sr-green/30"
      }
    >
      {label}
    </Link>
  );
}
