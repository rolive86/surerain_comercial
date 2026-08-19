import { getCatalogProducts } from "@/lib/catalog";
import {
  bulkConfirmMapAction,
  confirmMapAction,
  manualMapAction,
  rejectMapAction,
} from "@/lib/commercial/admin-actions";
import { listProductMaps, listTangoArticles } from "@/lib/commercial/admin-console";

export const dynamic = "force-dynamic";

const BULK_THRESHOLD = 0.9;

export default async function AdminMapeoPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; ok?: string; error?: string; q?: string; categoria?: string }>;
}) {
  const params = await searchParams;
  const vista = params.vista ?? "dudosos";
  const q = params.q?.trim().toLowerCase() ?? "";
  const categoria = params.categoria?.trim() ?? "";
  const [maps, catalog, tango] = await Promise.all([
    listProductMaps(),
    getCatalogProducts(),
    listTangoArticles(),
  ]);
  const catalogById = new Map(catalog.map((p) => [p.source_id, p]));
  const mappedIds = new Set(maps.map((m) => m.source_id));
  const unmatched = catalog.filter((p) => !mappedIds.has(p.source_id));
  const confirmed = maps.filter((m) => m.confirmed);
  const doubtful = maps.filter((m) => !m.confirmed);
  const catalogCount = catalog.length;
  const confirmedCount = confirmed.length;
  const coveragePct = catalogCount
    ? Math.round((confirmedCount / catalogCount) * 1000) / 10
    : 0;
  const bulkEligible = doubtful.filter((m) => Number(m.confidence ?? 0) >= BULK_THRESHOLD).length;
  const categories = [...new Set(catalog.map((p) => p.category_name).filter(Boolean))] as string[];
  categories.sort((a, b) => a.localeCompare(b, "es"));

  const tangoFiltered = q
    ? tango.filter(
        (t) =>
          t.cod_articulo.toLowerCase().includes(q) ||
          (t.descripcion ?? "").toLowerCase().includes(q),
      )
    : tango.slice(0, 40);

  const mapsForVista = vista === "confirmados" ? confirmed : doubtful;
  const filteredMaps = mapsForVista.filter((m) => {
    const product = catalogById.get(m.source_id);
    if (categoria && product?.category_name !== categoria) return false;
    if (!q) return true;
    const hay = `${m.catalog_name ?? ""} ${m.source_id} ${m.cod_articulo} ${m.tango_desc ?? ""} ${product?.category_name ?? ""}`;
    return hay.toLowerCase().includes(q);
  });
  const filteredUnmatched = unmatched.filter((p) => {
    if (categoria && p.category_name !== categoria) return false;
    if (!q) return true;
    return `${p.name} ${p.source_id} ${p.category_name ?? ""}`.toLowerCase().includes(q);
  });

  const qs = new URLSearchParams();
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (categoria) qs.set("categoria", categoria);
  const extra = qs.toString() ? `&${qs.toString()}` : "";

  return (
    <div className="space-y-6">
      {params.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{params.error}</p>
      ) : null}
      {params.ok ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {params.ok === "bulk" ? "Confirmados en lote los matches de alta confianza." : "Cambios guardados."}
        </p>
      ) : null}

      <p className="rounded-xl border border-sr-green/20 bg-white px-4 py-3 text-sm">
        <span className="font-semibold text-sr-ink">
          {confirmedCount}/{catalogCount}
        </span>{" "}
        catálogo con match confirmado ({coveragePct}%)
      </p>

      <form className="flex flex-wrap gap-2 rounded-xl border border-black/5 bg-white p-4" method="get">
        <input type="hidden" name="vista" value={vista} />
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Buscar nombre, código, source_id…"
          className="min-w-[14rem] flex-1 rounded-md border border-black/10 px-3 py-2 text-sm"
        />
        <select
          name="categoria"
          defaultValue={categoria}
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

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/gestion/admin/mapeo?vista=dudosos${extra}`}
          className={`btn-secondary ${vista === "dudosos" ? "!border-sr-green" : ""}`}
        >
          Dudosos ({doubtful.length})
        </a>
        <a
          href={`/gestion/admin/mapeo?vista=confirmados${extra}`}
          className={`btn-secondary ${vista === "confirmados" ? "!border-sr-green" : ""}`}
        >
          Confirmados ({confirmed.length})
        </a>
        <a
          href={`/gestion/admin/mapeo?vista=sin_match${extra}`}
          className={`btn-secondary ${vista === "sin_match" ? "!border-sr-green" : ""}`}
        >
          Sin match ({unmatched.length})
        </a>
        {vista === "dudosos" && bulkEligible > 0 ? (
          <form action={bulkConfirmMapAction}>
            <input type="hidden" name="threshold" value={String(BULK_THRESHOLD)} />
            <button type="submit" className="btn-primary">
              Confirmar {bulkEligible} con confianza ≥ {BULK_THRESHOLD}
            </button>
          </form>
        ) : null}
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
              {filteredMaps.map((m) => (
                <tr key={m.source_id}>
                  <td className="px-3 py-2">
                    <p className="font-semibold">{m.catalog_name}</p>
                    <p className="font-mono text-[11px] text-sr-ink/45">{m.source_id}</p>
                    {catalogById.get(m.source_id)?.category_name ? (
                      <p className="text-xs text-sr-ink/45">{catalogById.get(m.source_id)?.category_name}</p>
                    ) : null}
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
                {filteredUnmatched.slice(0, 80).map((p) => (
                  <tr key={p.source_id}>
                    <td className="px-3 py-2">
                      <p className="font-semibold">{p.name}</p>
                      <p className="font-mono text-[11px] text-sr-ink/45">{p.source_id}</p>
                      {p.category_name ? <p className="text-xs text-sr-ink/45">{p.category_name}</p> : null}
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
