import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getOrderForCustomer } from "@/lib/commercial/cart";
import { getCommercialSession } from "@/lib/commercial/session";

export const metadata: Metadata = {
  title: "Pedido confirmado",
  description: "Confirmación de pedido B2B Sure Rain.",
};

type Params = Promise<{ id: string }>;

export default async function PedidoPage({ params }: { params: Params }) {
  const session = await getCommercialSession();
  if (!session) redirect("/login?next=/cuenta");

  const { id } = await params;
  const order = await getOrderForCustomer(id);
  if (!order) notFound();

  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const history = Array.isArray(order.order_status_history)
    ? [...order.order_status_history].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
    : [];
  const notes = Array.isArray(order.order_notes)
    ? order.order_notes.filter((n) => n.note_type === "customer")
    : [];

  return (
    <div className="container-sr py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sr-green">
        Pedido confirmado
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold text-sr-green sm:text-4xl">
        {order.order_number}
      </h1>
      <p className="mt-2 text-sm text-sr-ink/60">
        Estado: <span className="font-semibold text-sr-ink">{order.status}</span>
        {order.submitted_at
          ? ` · enviado ${new Date(order.submitted_at).toLocaleString("es-AR")}`
          : null}
      </p>

      <section className="surface mt-8 p-6">
        <h2 className="font-display text-xl font-semibold">Ítems</h2>
        <ul className="mt-4 divide-y divide-black/5">
          {items.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-4 py-3">
              <div>
                <p className="font-medium">{item.product_name_snapshot}</p>
                <p className="font-mono text-xs text-sr-ink/45">{item.product_source_id}</p>
              </div>
              <p className="text-sm font-semibold">× {Number(item.quantity)}</p>
            </li>
          ))}
        </ul>
      </section>

      {notes.length ? (
        <section className="surface mt-4 p-6">
          <h2 className="font-display text-xl font-semibold">Tu nota</h2>
          {notes.map((n) => (
            <p key={n.id} className="mt-2 text-sm text-sr-ink/70">
              {n.body}
            </p>
          ))}
        </section>
      ) : null}

      <section className="surface mt-4 p-6">
        <h2 className="font-display text-xl font-semibold">Historial de estado</h2>
        <ol className="mt-4 space-y-2">
          {history.map((h) => (
            <li key={h.id} className="text-sm text-sr-ink/70">
              <span className="font-semibold text-sr-ink">{h.to_status}</span>
              {h.from_status ? ` ← ${h.from_status}` : ""}
              <span className="text-sr-ink/40">
                {" "}
                · {new Date(h.created_at).toLocaleString("es-AR")}
              </span>
              {h.comment ? <span className="block text-sr-ink/50">{h.comment}</span> : null}
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/catalogo" className="btn-primary">
          Seguir comprando
        </Link>
        <Link href="/carrito" className="btn-secondary">
          Nuevo carrito
        </Link>
      </div>
    </div>
  );
}
