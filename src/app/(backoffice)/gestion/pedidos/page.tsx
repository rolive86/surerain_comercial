import type { Metadata } from "next";
import Link from "next/link";
import {
  listBackofficeOrders,
  listFilterOptions,
} from "@/lib/commercial/backoffice";

export const metadata: Metadata = {
  title: "Pedidos · Comercial",
  description: "Panel de pedidos B2B Sure Rain.",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR");
}

export default async function GestionPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    estado?: string;
    cliente?: string;
    vendedor?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const params = await searchParams;
  const [orders, options] = await Promise.all([
    listBackofficeOrders({
      q: params.q?.trim() || undefined,
      status: params.estado?.trim() || undefined,
      customerId: params.cliente?.trim() || undefined,
      salesRepId: params.vendedor?.trim() || undefined,
      from: params.desde?.trim() || undefined,
      to: params.hasta?.trim() || undefined,
    }),
    listFilterOptions(),
  ]);

  const filterFields = (
    <>
      <label className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
        Número
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="SR-2026-"
          className="mt-1 min-h-11 w-full rounded-md border border-black/10 px-2 py-2 text-sm font-normal normal-case tracking-normal"
        />
      </label>
      <label className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
        Estado
        <select
          name="estado"
          defaultValue={params.estado ?? ""}
          className="mt-1 min-h-11 w-full rounded-md border border-black/10 px-2 py-2 text-sm font-normal normal-case tracking-normal"
        >
          <option value="">Todos</option>
          {options.statuses.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
        Cliente
        <select
          name="cliente"
          defaultValue={params.cliente ?? ""}
          className="mt-1 min-h-11 w-full rounded-md border border-black/10 px-2 py-2 text-sm font-normal normal-case tracking-normal"
        >
          <option value="">Todos</option>
          {options.customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.trade_name || c.legal_name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
        Vendedor
        <select
          name="vendedor"
          defaultValue={params.vendedor ?? ""}
          className="mt-1 min-h-11 w-full rounded-md border border-black/10 px-2 py-2 text-sm font-normal normal-case tracking-normal"
        >
          <option value="">Todos</option>
          {options.salesReps.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
        Desde
        <input
          type="date"
          name="desde"
          defaultValue={params.desde ?? ""}
          className="mt-1 min-h-11 w-full rounded-md border border-black/10 px-2 py-2 text-sm font-normal normal-case tracking-normal"
        />
      </label>
      <label className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
        Hasta
        <input
          type="date"
          name="hasta"
          defaultValue={params.hasta ?? ""}
          className="mt-1 min-h-11 w-full rounded-md border border-black/10 px-2 py-2 text-sm font-normal normal-case tracking-normal"
        />
      </label>
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-6">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          Filtrar
        </button>
        <Link href="/gestion/pedidos" className="btn-secondary w-full sm:w-auto">
          Limpiar
        </Link>
      </div>
    </>
  );

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-sr-ink sm:text-3xl">Pedidos</h1>
          <p className="mt-1 text-sm text-sr-ink/55">
            Filtros por número, cliente, vendedor, estado y fecha. Alcance según RLS.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/gestion/pedidos/nueva" className="btn-primary w-full sm:w-auto">
            Nueva cotización
          </Link>
          <p className="text-sm font-semibold text-sr-ink/50">{orders.length} resultado(s)</p>
        </div>
      </div>

      <form>
        <details
          open
          className="mt-6 rounded-xl border border-black/5 bg-white md:open"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-sr-ink md:hidden">
            Filtros
            <span className="text-xs font-medium text-sr-ink/45">Mostrar / ocultar</span>
          </summary>
          <div className="grid gap-3 border-t border-black/5 p-4 md:border-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {filterFields}
          </div>
        </details>
      </form>

      {orders.length === 0 ? (
        <div className="mt-8 rounded-xl border border-black/5 bg-white px-6 py-16 text-center text-sm text-sr-ink/55">
          No hay pedidos para estos filtros.
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-3 md:hidden">
            {orders.map((o) => (
              <li key={o.id} className="rounded-xl border border-black/5 bg-white p-4">
                <Link
                  href={`/gestion/pedidos/${o.id}`}
                  className="font-display text-lg font-semibold text-sr-green"
                >
                  {o.order_number}
                </Link>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-sr-ink/45">Cliente</dt>
                    <dd className="text-right font-medium">{o.customer_name}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-sr-ink/45">Vendedor</dt>
                    <dd className="text-right text-sr-ink/70">{o.sales_rep_name ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-sr-ink/45">Estado</dt>
                    <dd>
                      <span className="chip">{o.status_label}</span>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-sr-ink/45">Fecha</dt>
                    <dd className="text-right text-sr-ink/60">
                      {formatDate(o.submitted_at ?? o.created_at)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-sr-ink/45">Ítems</dt>
                    <dd className="font-medium">{o.item_count}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          <div className="mt-6 hidden overflow-x-auto rounded-xl border border-black/5 bg-white md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-black/5 bg-sr-mist/40 text-xs uppercase tracking-wider text-sr-ink/45">
                <tr>
                  <th className="px-4 py-3 font-semibold">Número</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Vendedor</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Ítems</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-sr-mist/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/gestion/pedidos/${o.id}`}
                        className="font-semibold text-sr-green hover:underline"
                      >
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{o.customer_name}</td>
                    <td className="px-4 py-3 text-sr-ink/70">{o.sales_rep_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="chip">{o.status_label}</span>
                    </td>
                    <td className="px-4 py-3 text-sr-ink/60">
                      {formatDate(o.submitted_at ?? o.created_at)}
                    </td>
                    <td className="px-4 py-3">{o.item_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
