import type { Metadata } from "next";
import Link from "next/link";
import {
  getClienteComparativo,
  getClientesARecontactar,
  getRankingZonaFamilia,
  listCarteraCustomers,
  listIntelFamilias,
  listIntelZones,
  monthLabel,
  periodLabel,
  waMeUrl,
} from "@/lib/commercial/intel";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import { getCommercialSession } from "@/lib/commercial/session";

export const metadata: Metadata = {
  title: "Inteligencia · Comercial",
  description: "Clientes a recontactar por temporada vs año anterior.",
};

export const dynamic = "force-dynamic";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function moneyArs(n: number) {
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function qty(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}

function parseIntParam(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function estadoLabel(estado: string) {
  switch (estado) {
    case "dejo_de_comprar":
      return "Dejó de comprar";
    case "nuevo":
      return "Nuevo";
    case "bajo":
      return "Bajó";
    case "subio":
      return "Subió";
    default:
      return "Igual";
  }
}

export default async function InteligenciaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = await getCommercialSession();
  requireStaffSession(session);

  const tab =
    sp.tab === "cliente" || sp.tab === "zona" ? sp.tab : "recontactar";

  const now = new Date();
  const defaultAnio = now.getFullYear() - 1;
  const mesDesde = Math.min(12, Math.max(1, parseIntParam(typeof sp.desde === "string" ? sp.desde : undefined, 8)));
  const mesHasta = Math.min(12, Math.max(mesDesde, parseIntParam(typeof sp.hasta === "string" ? sp.hasta : undefined, 10)));
  const anioBase = parseIntParam(typeof sp.anio === "string" ? sp.anio : undefined, defaultAnio);
  const familia = typeof sp.familia === "string" && sp.familia !== "all" ? sp.familia : undefined;
  const codArticulo = typeof sp.cod === "string" && sp.cod.trim() ? sp.cod.trim() : undefined;
  const localidad = typeof sp.localidad === "string" && sp.localidad !== "all" ? sp.localidad : undefined;
  const provincia = typeof sp.provincia === "string" && sp.provincia !== "all" ? sp.provincia : undefined;
  const customerId = typeof sp.customer === "string" ? sp.customer : undefined;
  const agruparPor = sp.agrupar === "provincia" ? "provincia" : "localidad";

  const [familias, zones, cartera] = await Promise.all([
    listIntelFamilias(),
    listIntelZones(),
    listCarteraCustomers(),
  ]);

  const periodoTxt = periodLabel(mesDesde, mesHasta);
  const productoTxt = familia || codArticulo || "ese producto/familia";

  let recontact: Awaited<ReturnType<typeof getClientesARecontactar>> = [];
  let comparativo: Awaited<ReturnType<typeof getClienteComparativo>> = [];
  let ranking: Awaited<ReturnType<typeof getRankingZonaFamilia>> = [];
  let errorMessage: string | null = null;

  try {
    if (tab === "recontactar") {
      recontact = await getClientesARecontactar({
        familia,
        codArticulo,
        mesDesde,
        mesHasta,
        anioBase,
        localidad,
        provincia,
      });
    } else if (tab === "cliente" && customerId) {
      comparativo = await getClienteComparativo(customerId, mesDesde, mesHasta, anioBase);
    } else if (tab === "zona") {
      ranking = await getRankingZonaFamilia(mesDesde, mesHasta, anioBase, agruparPor);
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Error al consultar.";
  }

  const tabHref = (t: string) => {
    const p = new URLSearchParams();
    p.set("tab", t);
    p.set("desde", String(mesDesde));
    p.set("hasta", String(mesHasta));
    p.set("anio", String(anioBase));
    if (familia) p.set("familia", familia);
    if (codArticulo) p.set("cod", codArticulo);
    if (localidad) p.set("localidad", localidad);
    if (provincia) p.set("provincia", provincia);
    if (customerId) p.set("customer", customerId);
    if (t === "zona") p.set("agrupar", agruparPor);
    return `/gestion/inteligencia?${p.toString()}`;
  };

  const selectedCustomerLabel =
    cartera.find((c) => c.id === customerId)?.label ?? null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-sr-ink sm:text-3xl">Inteligencia</h1>
        <p className="mt-1 text-sm text-sr-ink/55">
          Compará contra el mismo período del año anterior. Solo tu cartera (admin ve todo).
        </p>
      </div>

      <div className="-mx-1 mb-6 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible">
        {(
          [
            ["recontactar", "A recontactar"],
            ["cliente", "Cliente en el tiempo"],
            ["zona", "Por zona / familia"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={tabHref(key)}
            className={
              tab === key
                ? "chip min-h-10 shrink-0 bg-sr-green px-3 text-white"
                : "chip min-h-10 shrink-0 bg-white px-3 text-sr-ink/70"
            }
          >
            {label}
          </Link>
        ))}
      </div>

      <form>
        <details open className="mb-6 rounded-xl border border-black/5 bg-white">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-sr-ink md:hidden">
            Filtros
            <span className="text-xs font-medium text-sr-ink/45">Mostrar / ocultar</span>
          </summary>
          <div className="grid gap-3 border-t border-black/5 p-4 md:border-0 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="tab" value={tab} />
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Familia
              <select
                name="familia"
                defaultValue={familia ?? "all"}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
              >
                <option value="all">Todas</option>
                {familias.map((f) => (
                  <option key={f.slug} value={f.slug}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Código artículo
              <input
                name="cod"
                defaultValue={codArticulo ?? ""}
                placeholder="Opcional"
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Mes desde
              <select
                name="desde"
                defaultValue={String(mesDesde)}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Mes hasta
              <select
                name="hasta"
                defaultValue={String(mesHasta)}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Año a comparar
              <input
                name="anio"
                type="number"
                min={2020}
                max={now.getFullYear()}
                defaultValue={anioBase}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Localidad
              <select
                name="localidad"
                defaultValue={localidad ?? "all"}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
              >
                <option value="all">Todas</option>
                {zones.localidades.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Provincia
              <select
                name="provincia"
                defaultValue={provincia ?? "all"}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
              >
                <option value="all">Todas</option>
                {zones.provincias.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            {tab === "cliente" ? (
              <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45 sm:col-span-2">
                Cliente
                <select
                  name="customer"
                  defaultValue={customerId ?? ""}
                  required
                  className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
                >
                  <option value="" disabled>
                    Elegí un cliente…
                  </option>
                  {cartera.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {tab === "zona" ? (
              <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
                Agrupar por
                <select
                  name="agrupar"
                  defaultValue={agruparPor}
                  className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
                >
                  <option value="localidad">Localidad</option>
                  <option value="provincia">Provincia</option>
                </select>
              </label>
            ) : null}
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <button type="submit" className="btn-primary w-full">
                Aplicar
              </button>
            </div>
          </div>
        </details>
      </form>

      {errorMessage ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {tab === "recontactar" ? (
        <section>
          <p className="mb-4 rounded-xl border border-sr-green/20 bg-sr-green/5 px-4 py-3 text-sm text-sr-ink/80">
            Clientes que te compraban <strong>{productoTxt}</strong> en{" "}
            <strong>
              {periodoTxt} {anioBase}
            </strong>{" "}
            y este año ({anioBase + 1}) todavía no (o menos). Empezá por los de arriba.
          </p>
          {recontact.length === 0 ? (
            <div className="rounded-xl border border-black/5 bg-white px-4 py-8 text-center text-sm text-sr-ink/45">
              Nadie en tu cartera coincide con estos filtros.
            </div>
          ) : (
            <>
              <ul className="space-y-3 md:hidden">
                {recontact.map((row) => {
                  const wa = waMeUrl(
                    row.telefono,
                    `Hola ${row.cliente}, te contacto por ${productoTxt} de la temporada.`,
                  );
                  const quoteQs = new URLSearchParams({
                    customer: row.customer_id,
                  });
                  if (familia) quoteQs.set("familia", familia);
                  if (codArticulo) quoteQs.set("cod", codArticulo);
                  return (
                    <li key={row.customer_id} className="rounded-xl border border-black/5 bg-white p-4">
                      <Link
                        href={`/gestion/clientes/${row.customer_id}`}
                        className="font-display text-base font-semibold text-sr-ink"
                      >
                        {row.cliente}
                      </Link>
                      <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-sr-ink/45">Zona</dt>
                          <dd className="text-right text-sr-ink/65">
                            {[row.localidad, row.provincia].filter(Boolean).join(" · ") || "—"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-sr-ink/45">Cant. {anioBase}</dt>
                          <dd className="tabular-nums">{qty(row.cant_anio_base)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-sr-ink/45">Total {anioBase}</dt>
                          <dd className="tabular-nums font-medium">{moneyArs(row.total_anio_base)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-sr-ink/45">Última</dt>
                          <dd className="text-right text-sr-ink/60">
                            {row.ultima_compra
                              ? new Date(row.ultima_compra + "T12:00:00").toLocaleDateString("es-AR")
                              : "—"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-sr-ink/45">Cant. {anioBase + 1}</dt>
                          <dd
                            className={`tabular-nums ${
                              row.cant_anio_actual <= 0 ? "font-semibold text-amber-700" : ""
                            }`}
                          >
                            {qty(row.cant_anio_actual)}
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-black/5 pt-3">
                        {wa ? (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary min-h-11 flex-1 !px-3 text-xs"
                          >
                            WhatsApp
                          </a>
                        ) : null}
                        <Link
                          href={`/gestion/pedidos/nueva?${quoteQs.toString()}`}
                          className="btn-primary min-h-11 flex-1 !px-3 text-xs"
                        >
                          Nueva cotización
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden overflow-x-auto rounded-xl border border-black/5 bg-white md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-black/5 text-xs uppercase tracking-wider text-sr-ink/45">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Cliente</th>
                      <th className="px-4 py-3 font-semibold">Zona</th>
                      <th className="px-4 py-3 font-semibold text-right">Cant. {anioBase}</th>
                      <th className="px-4 py-3 font-semibold text-right">Total {anioBase}</th>
                      <th className="px-4 py-3 font-semibold">Última</th>
                      <th className="px-4 py-3 font-semibold text-right">Cant. {anioBase + 1}</th>
                      <th className="px-4 py-3 font-semibold">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {recontact.map((row) => {
                      const wa = waMeUrl(
                        row.telefono,
                        `Hola ${row.cliente}, te contacto por ${productoTxt} de la temporada.`,
                      );
                      const quoteQs = new URLSearchParams({
                        customer: row.customer_id,
                      });
                      if (familia) quoteQs.set("familia", familia);
                      if (codArticulo) quoteQs.set("cod", codArticulo);
                      return (
                        <tr key={row.customer_id} className="hover:bg-sr-mist/40">
                          <td className="px-4 py-3">
                            <Link
                              href={`/gestion/clientes/${row.customer_id}`}
                              className="font-semibold text-sr-ink hover:text-sr-green"
                            >
                              {row.cliente}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sr-ink/65">
                            {[row.localidad, row.provincia].filter(Boolean).join(" · ") || "—"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{qty(row.cant_anio_base)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">
                            {moneyArs(row.total_anio_base)}
                          </td>
                          <td className="px-4 py-3 text-sr-ink/60">
                            {row.ultima_compra
                              ? new Date(row.ultima_compra + "T12:00:00").toLocaleDateString("es-AR")
                              : "—"}
                          </td>
                          <td
                            className={`px-4 py-3 text-right tabular-nums ${
                              row.cant_anio_actual <= 0 ? "font-semibold text-amber-700" : ""
                            }`}
                          >
                            {qty(row.cant_anio_actual)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {wa ? (
                                <a
                                  href={wa}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-secondary !min-h-9 !px-3 text-xs"
                                >
                                  WhatsApp
                                </a>
                              ) : null}
                              <Link
                                href={`/gestion/pedidos/nueva?${quoteQs.toString()}`}
                                className="btn-primary !min-h-9 !px-3 text-xs"
                              >
                                Nueva cotización
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm text-sr-ink/50">{recontact.length} clientes en la lista.</p>
            </>
          )}
        </section>
      ) : null}

      {tab === "cliente" ? (
        <section>
          {!customerId ? (
            <p className="rounded-xl border border-black/5 bg-white px-4 py-8 text-center text-sm text-sr-ink/55">
              Elegí un cliente de tu cartera y aplicá filtros.
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm text-sr-ink/70">
                <strong>{selectedCustomerLabel}</strong> · {periodoTxt} {anioBase} vs{" "}
                {anioBase + 1}
              </p>
              {comparativo.length === 0 ? (
                <div className="rounded-xl border border-black/5 bg-white px-4 py-8 text-center text-sm text-sr-ink/45">
                  Sin movimientos en esos períodos.
                </div>
              ) : (
                <>
                  <ul className="space-y-3 md:hidden">
                    {comparativo.map((row) => (
                      <li key={row.cod_articulo} className="rounded-xl border border-black/5 bg-white p-4">
                        <p className="font-medium">{row.descripcion || row.cod_articulo}</p>
                        <p className="font-mono text-xs text-sr-ink/45">{row.cod_articulo}</p>
                        <dl className="mt-3 space-y-2 text-sm">
                          <div className="flex justify-between gap-3">
                            <dt className="text-sr-ink/45">Familia</dt>
                            <dd className="text-right text-sr-ink/60">{row.familia ?? "—"}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-sr-ink/45">{anioBase}</dt>
                            <dd className="text-right tabular-nums">
                              {qty(row.cant_anio_base)}
                              <span className="block text-xs text-sr-ink/40">
                                {moneyArs(row.total_anio_base)}
                              </span>
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-sr-ink/45">{anioBase + 1}</dt>
                            <dd className="text-right tabular-nums">
                              {qty(row.cant_anio_actual)}
                              <span className="block text-xs text-sr-ink/40">
                                {moneyArs(row.total_anio_actual)}
                              </span>
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-sr-ink/45">Estado</dt>
                            <dd>
                              <span className="chip text-xs">{estadoLabel(row.estado)}</span>
                            </dd>
                          </div>
                        </dl>
                      </li>
                    ))}
                  </ul>

                  <div className="hidden overflow-x-auto rounded-xl border border-black/5 bg-white md:block">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-black/5 text-xs uppercase tracking-wider text-sr-ink/45">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Artículo</th>
                          <th className="px-4 py-3 font-semibold">Familia</th>
                          <th className="px-4 py-3 font-semibold text-right">{anioBase}</th>
                          <th className="px-4 py-3 font-semibold text-right">{anioBase + 1}</th>
                          <th className="px-4 py-3 font-semibold">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {comparativo.map((row) => (
                          <tr key={row.cod_articulo}>
                            <td className="px-4 py-3">
                              <p className="font-medium">{row.descripcion || row.cod_articulo}</p>
                              <p className="font-mono text-xs text-sr-ink/45">{row.cod_articulo}</p>
                            </td>
                            <td className="px-4 py-3 text-sr-ink/60">{row.familia ?? "—"}</td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {qty(row.cant_anio_base)}
                              <span className="block text-xs text-sr-ink/40">
                                {moneyArs(row.total_anio_base)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {qty(row.cant_anio_actual)}
                              <span className="block text-xs text-sr-ink/40">
                                {moneyArs(row.total_anio_actual)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="chip text-xs">{estadoLabel(row.estado)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      ) : null}

      {tab === "zona" ? (
        <section>
          <p className="mb-4 text-sm text-sr-ink/70">
            Ranking por {agruparPor} · {periodoTxt} {anioBase} vs {anioBase + 1}
          </p>
          {ranking.length === 0 ? (
            <div className="rounded-xl border border-black/5 bg-white px-4 py-8 text-center text-sm text-sr-ink/45">
              Sin datos para el período.
            </div>
          ) : (
            <>
              <ul className="space-y-3 md:hidden">
                {ranking.map((row, i) => {
                  const delta = row.total_anio_actual - row.total_anio_base;
                  return (
                    <li key={`${row.zona}-${row.familia}-${i}`} className="rounded-xl border border-black/5 bg-white p-4">
                      <p className="font-medium">{row.zona}</p>
                      <p className="mt-0.5 text-sm text-sr-ink/60">{row.familia}</p>
                      <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-sr-ink/45">Total {anioBase}</dt>
                          <dd className="tabular-nums">{moneyArs(row.total_anio_base)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-sr-ink/45">Total {anioBase + 1}</dt>
                          <dd className="tabular-nums">{moneyArs(row.total_anio_actual)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-sr-ink/45">Δ</dt>
                          <dd
                            className={`tabular-nums ${
                              delta < 0 ? "text-amber-700" : delta > 0 ? "text-sr-green" : ""
                            }`}
                          >
                            {moneyArs(delta)}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden overflow-x-auto rounded-xl border border-black/5 bg-white md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-black/5 text-xs uppercase tracking-wider text-sr-ink/45">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Zona</th>
                      <th className="px-4 py-3 font-semibold">Familia</th>
                      <th className="px-4 py-3 font-semibold text-right">Total {anioBase}</th>
                      <th className="px-4 py-3 font-semibold text-right">Total {anioBase + 1}</th>
                      <th className="px-4 py-3 font-semibold text-right">Δ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {ranking.map((row, i) => {
                      const delta = row.total_anio_actual - row.total_anio_base;
                      return (
                        <tr key={`${row.zona}-${row.familia}-${i}`}>
                          <td className="px-4 py-3 font-medium">{row.zona}</td>
                          <td className="px-4 py-3">{row.familia}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {moneyArs(row.total_anio_base)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {moneyArs(row.total_anio_actual)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right tabular-nums ${
                              delta < 0 ? "text-amber-700" : delta > 0 ? "text-sr-green" : ""
                            }`}
                          >
                            {moneyArs(delta)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
