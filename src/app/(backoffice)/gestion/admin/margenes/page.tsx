import {
  deleteMarginAction,
  upsertMarginAction,
} from "@/lib/commercial/admin-actions";
import { listCustomersBrief, listMargins } from "@/lib/commercial/admin-console";

export const dynamic = "force-dynamic";

export default async function AdminMargenesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const [margins, customers] = await Promise.all([listMargins(), listCustomersBrief()]);
  const global = margins.find((m) => m.scope === "global" && m.active);

  return (
    <div className="space-y-6">
      {params.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{params.error}</p>
      ) : null}
      {params.ok ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Guardado. Se recalcularon los precios finales.
        </p>
      ) : null}

      <section className="rounded-xl border border-sr-green/20 bg-white p-5">
        <h2 className="font-display text-xl font-semibold text-sr-ink">Margen global</h2>
        <p className="mt-1 text-sm text-sr-ink/55">
          El margen global aplica a lo que no tenga regla más específica (producto → categoría →
          global).
        </p>
        <form action={upsertMarginAction} className="mt-4 flex flex-wrap items-end gap-3">
          {global ? <input type="hidden" name="id" value={global.id} /> : null}
          <input type="hidden" name="scope" value="global" />
          <label className="text-sm font-semibold text-sr-ink/70">
            %
            <input
              name="percent"
              type="number"
              step="0.1"
              defaultValue={global?.percent ?? 35}
              className="ml-2 w-28 rounded-md border border-black/10 px-3 py-2"
              required
            />
          </label>
          <button type="submit" className="btn-primary">
            Guardar global
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-black/5 bg-white p-5">
        <h2 className="font-display text-lg font-semibold text-sr-ink">Nueva regla</h2>
        <form action={upsertMarginAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Alcance
            <select name="scope" className="mt-1 w-full rounded-md border border-black/10 px-3 py-2">
              <option value="category">Categoría</option>
              <option value="product">Producto (cod Tango)</option>
              <option value="customer">Cliente</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            %
            <input
              name="percent"
              type="number"
              step="0.1"
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2"
              required
            />
          </label>
          <label className="text-sm font-semibold">
            Categoría
            <input
              name="category"
              placeholder="familia / categoría"
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold">
            Código Tango
            <input
              name="cod_articulo"
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Cliente
            <select name="customer_id" className="mt-1 w-full rounded-md border border-black/10 px-3 py-2">
              <option value="">—</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.trade_name || c.legal_name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-secondary sm:col-span-2 w-fit">
            Crear regla
          </button>
        </form>
      </section>

      <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-black/5 text-xs uppercase tracking-wider text-sr-ink/45">
            <tr>
              <th className="px-4 py-3">Alcance</th>
              <th className="px-4 py-3">Destino</th>
              <th className="px-4 py-3">%</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {margins.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 font-semibold">{m.scope}</td>
                <td className="px-4 py-3 text-sr-ink/70">
                  {m.scope === "global"
                    ? "Todos (sin regla más específica)"
                    : m.scope === "category"
                      ? m.category
                      : m.scope === "product"
                        ? m.cod_articulo
                        : m.customer_name}
                </td>
                <td className="px-4 py-3">{m.percent}</td>
                <td className="px-4 py-3 text-right">
                  {m.scope !== "global" ? (
                    <form action={deleteMarginAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" className="text-sm text-red-700 hover:underline">
                        Borrar
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
