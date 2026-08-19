import { formatFinalUsd } from "@/lib/commercial/money";
import { listAdminPrices } from "@/lib/commercial/admin-console";

export const dynamic = "force-dynamic";

export default async function AdminPreciosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string }>;
}) {
  const params = await searchParams;
  const { rows, categories, tangoPriceCount } = await listAdminPrices({
    q: params.q,
    category: params.categoria,
  });

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Hoy hay {tangoPriceCount} precio(s) base porque el dump Tango de lista 29 es una muestra.
        El resto aparece como sin precio hasta recargar `precios_raw` completo.
      </p>
      <form className="flex flex-wrap gap-2 rounded-xl border border-black/5 bg-white p-4">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Código, descripción, source_id…"
          className="min-w-[14rem] flex-1 rounded-md border border-black/10 px-3 py-2 text-sm"
        />
        <select
          name="categoria"
          defaultValue={params.categoria ?? ""}
          className="rounded-md border border-black/10 px-3 py-2 text-sm"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-black/5 text-xs uppercase tracking-wider text-sr-ink/45">
            <tr>
              <th className="px-3 py-3">Código</th>
              <th className="px-3 py-3">Descripción</th>
              <th className="px-3 py-3">Base USD</th>
              <th className="px-3 py-3">Margen %</th>
              <th className="px-3 py-3">Final USD</th>
              <th className="px-3 py-3">Regla aplicada</th>
              <th className="px-3 py-3">Mapa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.map((r) => (
              <tr key={r.cod_articulo} className="hover:bg-sr-mist/40">
                <td className="px-3 py-2 font-mono text-xs">{r.cod_articulo}</td>
                <td className="px-3 py-2">{r.descripcion ?? "—"}</td>
                <td className="px-3 py-2">
                  {r.base != null ? formatFinalUsd(r.base) : (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      sin precio
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{r.margin_percent ?? "0"}</td>
                <td className="px-3 py-2 font-semibold">
                  {r.final != null ? formatFinalUsd(r.final) : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-sr-ink/60">{r.applied_rule}</td>
                <td className="px-3 py-2 text-xs text-sr-ink/55">
                  {r.mapped ? "mapeado" : "sin map"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
