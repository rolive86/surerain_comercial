import { getCatalogProducts } from "@/lib/catalog";
import {
  confirmMapAction,
  manualMapAction,
  rejectMapAction,
} from "@/lib/commercial/admin-actions";
import { listProductMaps, listTangoArticles } from "@/lib/commercial/admin-console";

export const dynamic = "force-dynamic";

export default async function AdminMapeoPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; ok?: string; error?: string; q?: string }>;
}) {
  const params = await searchParams;
  const vista = params.vista ?? "dudosos";
  const [maps, catalog, tango] = await Promise.all([
    listProductMaps(),
    getCatalogProducts(),
    listTangoArticles(),
  ]);
  const mappedIds = new Set(maps.map((m) => m.source_id));
  const unmatched = catalog.filter((p) => !mappedIds.has(p.source_id));
  const confirmed = maps.filter((m) => m.confirmed);
  const doubtful = maps.filter((m) => !m.confirmed);
  const q = params.q?.trim().toLowerCase() ?? "";
  const tangoFiltered = q
    ? tango.filter(
        (t) =>
          t.cod_articulo.toLowerCase().includes(q) ||
          (t.descripcion ?? "").toLowerCase().includes(q),
      )
    : tango.slice(0, 40);

  const list =
    vista === "confirmados" ? confirmed : vista === "sin_match" ? unmatched : doubtful;

  return (
    <div className="space-y-6">
      {params.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{params.error}</p>
      ) : null}
      {params.ok ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Cambios guardados.</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <a
          href="/gestion/admin/mapeo?vista=dudosos"
          className={`btn-secondary ${vista === "dudosos" ? "!border-sr-green" : ""}`}
        >
          Dudosos ({doubtful.length})
        </a>
        <a
          href="/gestion/admin/mapeo?vista=confirmados"
          className={`btn-secondary ${vista === "confirmados" ? "!border-sr-green" : ""}`}
        >
          Confirmados ({confirmed.length})
        </a>
        <a
          href="/gestion/admin/mapeo?vista=sin_match"
          className={`btn-secondary ${vista === "sin_match" ? "!border-sr-green" : ""}`}
        >
          Sin match ({unmatched.length})
        </a>
      </div>

      {vista !== "sin_match" ? (
        <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-black/5 text-xs uppercase text-sr-ink/45">
              <tr>
                <th className="px-3 py-3">Catálogo</th>
                <th className="px-3 py-3">Tango</th>
                <th className="px-3 py-3">Método</th>
                <th className="px-3 py-3">Conf</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {(list as typeof maps).map((m) => (
                <tr key={m.source_id}>
                  <td className="px-3 py-2">
                    <p className="font-semibold">{m.catalog_name}</p>
                    <p className="font-mono text-[11px] text-sr-ink/45">{m.source_id}</p>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-mono text-xs">{m.cod_articulo}</p>
                    <p className="text-xs text-sr-ink/55">{m.tango_desc}</p>
                  </td>
                  <td className="px-3 py-2">{m.match_method}</td>
                  <td className="px-3 py-2">{m.confidence ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      {!m.confirmed ? (
                        <form action={confirmMapAction}>
                          <input type="hidden" name="source_id" value={m.source_id} />
                          <button type="submit" className="text-sm font-semibold text-sr-green">
                            Confirmar
                          </button>
                        </form>
                      ) : null}
                      <form action={rejectMapAction}>
                        <input type="hidden" name="source_id" value={m.source_id} />
                        <button type="submit" className="text-sm text-red-700">
                          Rechazar
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-black/5 text-xs uppercase text-sr-ink/45">
                <tr>
                  <th className="px-3 py-3">Sin match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {unmatched.slice(0, 80).map((p) => (
                  <tr key={p.source_id}>
                    <td className="px-3 py-2">
                      <p className="font-semibold">{p.name}</p>
                      <p className="font-mono text-[11px] text-sr-ink/45">{p.source_id}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <section className="rounded-xl border border-black/5 bg-white p-5">
            <h2 className="font-display text-lg font-semibold">Matchear manual</h2>
            <form action={manualMapAction} className="mt-3 space-y-3">
              <label className="block text-sm font-semibold">
                source_id catálogo
                <input
                  name="source_id"
                  required
                  className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 font-mono text-xs"
                />
              </label>
              <label className="block text-sm font-semibold">
                Nombre catálogo
                <input name="catalog_name" className="mt-1 w-full rounded-md border border-black/10 px-3 py-2" />
              </label>
              <label className="block text-sm font-semibold">
                cod_articulo Tango
                <input
                  name="cod_articulo"
                  required
                  className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 font-mono text-xs"
                />
              </label>
              <button type="submit" className="btn-primary">
                Asignar y confirmar
              </button>
            </form>
            <form className="mt-6" method="get">
              <input type="hidden" name="vista" value="sin_match" />
              <input
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Buscar código Tango…"
                className="w-full rounded-md border border-black/10 px-3 py-2 text-sm"
              />
            </form>
            <ul className="mt-3 max-h-64 space-y-1 overflow-auto text-xs">
              {tangoFiltered.map((t) => (
                <li key={t.cod_articulo} className="font-mono">
                  {t.cod_articulo}
                  <span className="ml-2 font-sans text-sr-ink/55">{t.descripcion}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
