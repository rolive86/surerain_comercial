import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addInternalNoteAction,
  changeOrderStatusAction,
} from "@/lib/commercial/backoffice-actions";
import {
  getBackofficeOrderDetail,
  listFilterOptions,
} from "@/lib/commercial/backoffice";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const order = await getBackofficeOrderDetail(id);
    return { title: order ? `${order.order_number} · Gestión` : "Pedido" };
  } catch {
    return { title: "Pedido" };
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR");
}

export default async function GestionPedidoDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const flash = await searchParams;
  const [order, options] = await Promise.all([
    getBackofficeOrderDetail(id),
    listFilterOptions(),
  ]);
  if (!order) notFound();

  return (
    <div>
      <nav className="mb-4 text-sm text-sr-ink/50">
        <Link href="/gestion/pedidos" className="hover:text-sr-green">
          Pedidos
        </Link>
        <span className="mx-2">/</span>
        <span>{order.order_number}</span>
      </nav>

      {flash.error ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {flash.error}
        </p>
      ) : null}
      {flash.ok ? (
        <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {flash.ok === "note" ? "Nota interna guardada." : "Estado actualizado."}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-sr-ink">{order.order_number}</h1>
          <p className="mt-2 text-sm text-sr-ink/60">
            <span className="chip">{order.status_label}</span>
            <span className="ml-2">{order.customer_name}</span>
            {order.sales_rep_name ? (
              <span className="text-sr-ink/45"> · vendedor {order.sales_rep_name}</span>
            ) : null}
          </p>
        </div>
        <p className="text-sm text-sr-ink/50">
          Enviado: {formatDate(order.submitted_at ?? order.created_at)}
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-xl border border-black/5 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Ítems</h2>
          <ul className="mt-3 divide-y divide-black/5">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{item.product_name_snapshot}</p>
                  <p className="font-mono text-xs text-sr-ink/40">{item.product_source_id}</p>
                </div>
                <p className="font-semibold">× {item.quantity}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-black/5 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Cambiar estado</h2>
          <form action={changeOrderStatusAction} className="mt-3 space-y-3">
            <input type="hidden" name="order_id" value={order.id} />
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Nuevo estado
              <select
                name="to_status"
                required
                defaultValue=""
                className="mt-1 w-full rounded-md border border-black/10 px-2 py-2 text-sm font-normal normal-case tracking-normal"
              >
                <option value="" disabled>
                  Seleccionar…
                </option>
                {options.statuses
                  .filter((s) => s.code !== order.status)
                  .map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Comentario (opcional)
              <textarea
                name="comment"
                rows={2}
                className="mt-1 w-full rounded-md border border-black/10 px-2 py-2 text-sm font-normal normal-case tracking-normal"
              />
            </label>
            <button type="submit" className="btn-primary w-full">
              Guardar cambio
            </button>
          </form>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-black/5 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Historial</h2>
          <ol className="mt-3 space-y-3 border-l border-sr-green/20 pl-4">
            {order.history.map((h) => (
              <li key={h.id} className="relative text-sm">
                <span className="absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full bg-sr-green" />
                <p className="font-semibold text-sr-ink">{h.to_status_label}</p>
                <p className="text-xs text-sr-ink/40">{formatDate(h.created_at)}</p>
                {h.comment ? <p className="mt-1 text-sr-ink/60">{h.comment}</p> : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl border border-black/5 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Notas</h2>
          <ul className="mt-3 space-y-2">
            {order.notes.length === 0 ? (
              <li className="text-sm text-sr-ink/45">Sin notas.</li>
            ) : (
              order.notes.map((n) => (
                <li key={n.id} className="rounded-md bg-sr-mist/60 px-3 py-2 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-sr-ink/40">
                    {n.note_type === "internal" ? "Interna" : "Cliente"}
                  </p>
                  <p className="mt-1 text-sr-ink/75">{n.body}</p>
                </li>
              ))
            )}
          </ul>
          <form action={addInternalNoteAction} className="mt-4 space-y-2 border-t border-black/5 pt-4">
            <input type="hidden" name="order_id" value={order.id} />
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Nota interna
              <textarea
                name="body"
                required
                rows={2}
                className="mt-1 w-full rounded-md border border-black/10 px-2 py-2 text-sm font-normal normal-case tracking-normal"
              />
            </label>
            <button type="submit" className="btn-secondary">
              Agregar nota interna
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
