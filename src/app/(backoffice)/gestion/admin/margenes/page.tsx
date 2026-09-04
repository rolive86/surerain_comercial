import { deleteMarginAction } from "@/lib/commercial/admin-actions";
import { listCustomersBrief, listMargins, listTangoFamilies } from "@/lib/commercial/admin-console";
import { MarginEditor } from "@/components/MarginEditor";

export const dynamic = "force-dynamic";

export default async function AdminMargenesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const [margins, customers, families] = await Promise.all([
    listMargins(),
    listCustomersBrief(),
    listTangoFamilies(),
  ]);
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
          El margen global aplica a lo que no tenga regla más específica (producto → familia Tango →
          global). La familia sale de `articulos_raw.familia` (o categoría Excel si falta).
        </p>
        <MarginEditor
          id={global?.id}
          scope="global"
          percent={global?.percent ?? 35}
          customers={customers}
          families={families}
          submitLabel="Guardar global"
        />
      </section>

      <section className="rounded-xl border border-black/5 bg-white p-5">
        <h2 className="font-display text-lg font-semibold text-sr-ink">Nueva regla</h2>
        <MarginEditor
          scope="category"
          customers={customers}
          families={families}
          submitLabel="Crear regla"
        />
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
