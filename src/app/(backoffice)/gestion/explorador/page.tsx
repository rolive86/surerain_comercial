import type { Metadata } from "next";
import Link from "next/link";
import {
  defaultYearRange,
  formatExplorerValue,
  getExplorerOptions,
  groupLabel,
  metricLabel,
  rowsToCsv,
  runVentasExplorer,
  type ExplorerGroupBy,
  type ExplorerMetric,
} from "@/lib/commercial/explorer";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import { getCommercialSession } from "@/lib/commercial/session";
import { ExplorerBars, ExplorerCsvButton } from "@/components/ExplorerWidgets";

export const metadata: Metadata = {
  title: "Explorador · Gestión",
  description: "Cruces dinámicos de ventas sobre historial Tango.",
};

export const dynamic = "force-dynamic";

const GROUPS: ExplorerGroupBy[] = [
  "cliente",
  "localidad",
  "provincia",
  "familia",
  "producto",
  "vendedor",
  "mes",
  "anio",
];

const METRICS: ExplorerMetric[] = [
  "facturacion",
  "cantidad",
  "comprobantes",
  "clientes",
];

function asString(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function parseGroup(v: string | undefined): ExplorerGroupBy {
  return GROUPS.includes(v as ExplorerGroupBy) ? (v as ExplorerGroupBy) : "familia";
}

function parseMetric(v: string | undefined): ExplorerMetric {
  return METRICS.includes(v as ExplorerMetric) ? (v as ExplorerMetric) : "facturacion";
}

export default async function ExploradorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = await getCommercialSession();
  requireStaffSession(session);

  const year = new Date().getFullYear();
  const defaults = defaultYearRange(year);

  const groupBy = parseGroup(asString(sp.group));
  const metric = parseMetric(asString(sp.metric));
  const fechaDesde = asString(sp.desde) || defaults.desde;
  const fechaHasta = asString(sp.hasta) || defaults.hasta;
  const familia =
    asString(sp.familia) && asString(sp.familia) !== "all"
      ? asString(sp.familia)
      : undefined;
  const codArticulo = asString(sp.cod)?.trim() || undefined;
  const localidad =
    asString(sp.localidad) && asString(sp.localidad) !== "all"
      ? asString(sp.localidad)
      : undefined;
  const provincia =
    asString(sp.provincia) && asString(sp.provincia) !== "all"
      ? asString(sp.provincia)
      : undefined;
  const compararInteranual =
    asString(sp.interanual) === "1" || asString(sp.interanual) === "true";

  const [{ familias, zones }, rowsResult] = await Promise.all([
    getExplorerOptions(),
    runVentasExplorer({
      groupBy,
      metric,
      fechaDesde,
      fechaHasta,
      familia,
      codArticulo,
      localidad,
      provincia,
      compararInteranual,
    })
      .then((rows) => ({ rows, error: null as string | null }))
      .catch((err: unknown) => ({
        rows: [] as Awaited<ReturnType<typeof runVentasExplorer>>,
        error: err instanceof Error ? err.message : "Error al consultar",
      })),
  ]);

  const { rows, error } = rowsResult;
  const csv = rowsToCsv(rows, metric, compararInteranual);

  const preset = (label: string, qs: Record<string, string>) => {
    const p = new URLSearchParams(qs);
    return (
      <Link
        href={`/gestion/explorador?${p.toString()}`}
        className="chip min-h-10 bg-white px-3 text-sr-ink/75 hover:border-sr-green/30"
      >
        {label}
      </Link>
    );
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-sr-ink">Explorador</h1>
          <p className="mt-1 text-sm text-sr-ink/55">
            Armá cruces con menús sobre tu historial de ventas. Solo tu cartera (admin ve todo).
          </p>
        </div>
        <ExplorerCsvButton csv={csv} filename={`explorador-${groupBy}-${metric}.csv`} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {preset("Facturación por familia (este año vs anterior)", {
          group: "familia",
          metric: "facturacion",
          desde: defaults.desde,
          hasta: defaults.hasta,
          interanual: "1",
        })}
        {preset("Top clientes del período", {
          group: "cliente",
          metric: "facturacion",
          desde: defaults.desde,
          hasta: defaults.hasta,
          interanual: "0",
        })}
        {preset("Ventas por zona", {
          group: "localidad",
          metric: "facturacion",
          desde: defaults.desde,
          hasta: defaults.hasta,
          interanual: "0",
        })}
      </div>

      <form
        method="get"
        className="mb-6 grid gap-3 rounded-xl border border-black/5 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
          Medir
          <select
            name="metric"
            defaultValue={metric}
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
          >
            {METRICS.map((m) => (
              <option key={m} value={m}>
                {metricLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
          Agrupar por
          <select
            name="group"
            defaultValue={groupBy}
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
          >
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {groupLabel(g)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
          Desde
          <input
            type="date"
            name="desde"
            defaultValue={fechaDesde}
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
          Hasta
          <input
            type="date"
            name="hasta"
            defaultValue={fechaHasta}
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
          />
        </label>
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
        <label className="flex items-end gap-2 text-sm text-sr-ink/80 sm:col-span-2">
          <input
            type="checkbox"
            name="interanual"
            value="1"
            defaultChecked={compararInteranual}
            className="h-4 w-4 rounded border-black/20"
          />
          Comparar interanual (mismo período año anterior)
        </label>
        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <button type="submit" className="btn-primary w-full">
            Aplicar
          </button>
        </div>
      </form>

      {error ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <p className="mb-3 text-sm text-sr-ink/60">
        {metricLabel(metric)} por {groupLabel(groupBy).toLowerCase()} · {fechaDesde} →{" "}
        {fechaHasta}
        {compararInteranual ? " · vs mismo período año anterior" : ""}
        {rows.length ? ` · ${rows.length} filas` : ""}
      </p>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-black/5 text-xs uppercase tracking-wider text-sr-ink/45">
              <tr>
                <th className="px-4 py-3 font-semibold">{groupLabel(groupBy)}</th>
                <th className="px-4 py-3 font-semibold text-right">{metricLabel(metric)}</th>
                {compararInteranual ? (
                  <>
                    <th className="px-4 py-3 font-semibold text-right">Año anterior</th>
                    <th className="px-4 py-3 font-semibold text-right">Var %</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={compararInteranual ? 4 : 2}
                    className="px-4 py-8 text-center text-sr-ink/45"
                  >
                    Sin datos para estos filtros.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.dimension} className="hover:bg-sr-mist/40">
                    <td className="px-4 py-3 font-medium text-sr-ink">{r.dimension}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatExplorerValue(metric, r.valor)}
                    </td>
                    {compararInteranual ? (
                      <>
                        <td className="px-4 py-3 text-right tabular-nums text-sr-ink/65">
                          {r.valor_anio_anterior == null
                            ? "—"
                            : formatExplorerValue(metric, r.valor_anio_anterior)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right tabular-nums font-medium ${
                            (r.variacion_pct ?? 0) > 0
                              ? "text-sr-green"
                              : (r.variacion_pct ?? 0) < 0
                                ? "text-red-600"
                                : "text-sr-ink/50"
                          }`}
                        >
                          {r.variacion_pct == null
                            ? "—"
                            : `${r.variacion_pct > 0 ? "+" : ""}${r.variacion_pct}%`}
                        </td>
                      </>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <ExplorerBars rows={rows} metric={metric} />
      </div>
    </div>
  );
}
