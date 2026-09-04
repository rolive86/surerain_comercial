import Link from "next/link";
import {
  createProductGroupAction,
  moveVariantAction,
  saveProductGroupAction,
} from "@/lib/commercial/admin-actions";
import {
  getProductGroupById,
  getProductGroupCoverage,
  listProductGroups,
} from "@/lib/commercial/product-groups";
import { listTangoArticles } from "@/lib/commercial/admin-console";

export const dynamic = "force-dynamic";

export default async function AdminVariantesPage({
  searchParams,
}: {
  searchParams: Promise<{
    id?: string;
    q?: string;
    review?: string;
    ok?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const reviewOnly = params.review !== "0";
  const [coverage, groups, selected, tango] = await Promise.all([
    getProductGroupCoverage(),
    listProductGroups({ q, needsReviewOnly: reviewOnly }),
    params.id ? getProductGroupById(params.id) : Promise.resolve(null),
    listTangoArticles(),
  ]);

  const allGroups = await listProductGroups({ needsReviewOnly: false });

  return (
    <div className="space-y-6">
      {params.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{params.error}</p>
      ) : null}
      {params.ok ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Cambios guardados (source=manual; el agrupador no los pisa).
        </p>
      ) : null}

      <p className="rounded-xl border border-sr-green/20 bg-white px-4 py-3 text-sm">
        <span className="font-semibold text-sr-ink">
          {coverage.reviewed}/{coverage.total}
        </span>{" "}
        grupos revisados
        {coverage.needsReview ? (
          <span className="text-sr-ink/55">
            {" "}
            · {coverage.needsReview} requieren revisión
          </span>
        ) : null}
      </p>

      <form className="flex flex-wrap gap-2 rounded-xl border border-black/5 bg-white p-4" method="get">
        {params.id ? <input type="hidden" name="id" value={params.id} /> : null}
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar grupo, familia, slug…"
          className="min-w-[14rem] flex-1 rounded-md border border-black/10 px-3 py-2 text-sm"
        />
        <label className="inline-flex items-center gap-2 text-sm text-sr-ink/70">
          <input
            type="checkbox"
            name="review"
            value="1"
            defaultChecked={reviewOnly}
          />
          Solo requieren revisión
        </label>
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
        <Link href="/gestion/admin/variantes?review=0" className="btn-secondary">
          Todos
        </Link>
      </form>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-black/5 bg-white">
          <ul className="divide-y divide-black/5 text-sm">
            {groups.length === 0 ? (
              <li className="px-4 py-8 text-center text-sr-ink/45">Sin grupos</li>
            ) : (
              groups.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/gestion/admin/variantes?id=${g.id}&review=${reviewOnly ? "1" : "0"}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                    className={`block px-4 py-3 hover:bg-sr-mist/50 ${
                      selected?.id === g.id ? "bg-sr-green/10" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sr-ink">{g.name}</span>
                      {g.needs_review ? (
                        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                          Revisar
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-sr-ink/45">
                      {g.variant_count} var · {g.familia ?? "sin familia"} · {g.source}
                    </p>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="space-y-6">
          {selected ? (
            <section className="rounded-xl border border-black/5 bg-white p-5">
              <h2 className="font-display text-xl font-semibold text-sr-ink">
                Editar grupo
              </h2>
              <p className="mt-1 text-xs text-sr-ink/45">
                slug: {selected.slug ?? "—"} · al guardar → source=manual
              </p>
              <form action={saveProductGroupAction} className="mt-4 space-y-4">
                <input type="hidden" name="id" value={selected.id} />
                <label className="block text-sm">
                  <span className="font-semibold text-sr-ink/70">Nombre padre</span>
                  <input
                    name="name"
                    required
                    defaultValue={selected.name}
                    className="mt-1 w-full rounded-md border border-black/10 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-sr-ink/70">Familia</span>
                  <input
                    name="familia"
                    defaultValue={selected.familia ?? ""}
                    className="mt-1 w-full rounded-md border border-black/10 px-3 py-2"
                  />
                </label>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wider text-sr-ink/45">
                      <tr>
                        <th className="py-2 pr-3">Código</th>
                        <th className="py-2 pr-3">Label</th>
                        <th className="py-2">Orden</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {selected.variants.map((v, i) => (
                        <tr key={v.cod_articulo}>
                          <td className="py-2 pr-3 font-mono text-xs">
                            <input type="hidden" name="cod_articulo" value={v.cod_articulo} />
                            {v.cod_articulo}
                            <p className="mt-0.5 max-w-[14rem] truncate text-[11px] text-sr-ink/40">
                              {v.descripcion}
                            </p>
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              name="variant_label"
                              defaultValue={v.variant_label ?? ""}
                              className="w-full min-w-[8rem] rounded-md border border-black/10 px-2 py-1.5"
                            />
                          </td>
                          <td className="py-2">
                            <input
                              name="sort_order"
                              type="number"
                              defaultValue={v.sort_order ?? i}
                              className="w-20 rounded-md border border-black/10 px-2 py-1.5"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="submit" className="btn-primary">
                  Guardar grupo
                </button>
              </form>

              <div className="mt-6 border-t border-black/5 pt-4">
                <h3 className="text-sm font-semibold text-sr-ink">Mover / sacar variante</h3>
                <ul className="mt-3 space-y-2">
                  {selected.variants.map((v) => (
                    <li key={`move-${v.cod_articulo}`}>
                      <form action={moveVariantAction} className="flex flex-wrap items-center gap-2 text-sm">
                        <input type="hidden" name="from_id" value={selected.id} />
                        <input type="hidden" name="cod_articulo" value={v.cod_articulo} />
                        <input
                          type="hidden"
                          name="variant_label"
                          value={v.variant_label ?? v.cod_articulo}
                        />
                        <span className="font-mono text-xs text-sr-ink/70">{v.cod_articulo}</span>
                        <select
                          name="to_group_id"
                          defaultValue=""
                          className="max-w-[14rem] rounded-md border border-black/10 px-2 py-1 text-xs"
                        >
                          <option value="">Mover a…</option>
                          <option value="none">Sacar (simple)</option>
                          {allGroups
                            .filter((g) => g.id !== selected.id)
                            .slice(0, 120)
                            .map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                        </select>
                        <button type="submit" className="btn-secondary !min-h-8 !px-2 !text-xs">
                          Aplicar
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : (
            <p className="rounded-xl border border-dashed border-black/10 bg-white px-5 py-10 text-center text-sm text-sr-ink/50">
              Elegí un grupo de la lista para editarlo.
            </p>
          )}

          <section className="rounded-xl border border-black/5 bg-white p-5">
            <h2 className="font-display text-lg font-semibold text-sr-ink">
              Crear grupo nuevo
            </h2>
            <form action={createProductGroupAction} className="mt-3 space-y-3">
              <label className="block text-sm">
                <span className="font-semibold text-sr-ink/70">Nombre padre</span>
                <input
                  name="name"
                  required
                  className="mt-1 w-full rounded-md border border-black/10 px-3 py-2"
                  placeholder="Ej. ADAP. LAY FLAT RM"
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-sr-ink/70">Familia</span>
                <input
                  name="familia"
                  className="mt-1 w-full rounded-md border border-black/10 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-sr-ink/70">
                  Códigos Tango (mín. 2, separados por coma o espacio)
                </span>
                <textarea
                  name="codes"
                  required
                  rows={3}
                  className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 font-mono text-xs"
                  placeholder={tango
                    .slice(0, 2)
                    .map((t) => t.cod_articulo)
                    .join(", ")}
                />
              </label>
              <button type="submit" className="btn-primary">
                Crear grupo
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
