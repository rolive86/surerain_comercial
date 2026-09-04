import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  empresaLabel,
  fetchComercialDashboard,
  fmtMoney,
  fmtMoneyCompact,
  fmtPct,
  MES_LABELS,
  type EmpresaFilter,
  type MonedaFilter,
} from "@/lib/commercial/comercial-dashboard";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import { getCommercialSession } from "@/lib/commercial/session";
import { ComercialCharts } from "./ComercialCharts";

export const metadata: Metadata = {
  title: "Dashboard · Comercial",
  description: "BI comercial sobre v_ventas (Sure Rain + Angus).",
};

export const dynamic = "force-dynamic";

function asString(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function parseEmpresa(v: string | undefined): EmpresaFilter {
  if (v === "3" || v === "5" || v === "todas") return v;
  return "todas";
}

function parseMoneda(v: string | undefined): MonedaFilter {
  return v?.toUpperCase() === "USD" ? "USD" : "ARS";
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function deltaClass(n: number | null | undefined): string {
  if (n === null || n === undefined) return "text-sr-ink/40";
  if (n > 0.05) return "text-sr-green-light";
  if (n < -0.05) return "text-red-600";
  return "text-sr-ink/45";
}

export default async function ComercialDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = requireStaffSession(await getCommercialSession());
  const role = session.claims.app_role;
  if (
    role !== "admin" &&
    role !== "sales_manager" &&
    role !== "operations"
  ) {
    redirect("/gestion/pedidos");
  }

  const empresa = parseEmpresa(asString(sp.empresa));
  const moneda = parseMoneda(asString(sp.moneda));
  const fecha = asString(sp.fecha) || todayISO();
  const vendedor =
    asString(sp.vendedor) && asString(sp.vendedor) !== "all"
      ? asString(sp.vendedor)
      : undefined;
  const familia =
    asString(sp.familia) && asString(sp.familia) !== "all"
      ? asString(sp.familia)
      : undefined;
  const periodoRanking =
    asString(sp.periodo) === "anio" ? ("anio" as const) : ("mes" as const);

  const { kpis, matriz, ranking, empresas, dimensiones, error } =
    await fetchComercialDashboard({
      empresa,
      moneda,
      fecha,
      vendedor,
      familia,
      periodoRanking,
    });

  const anioCur = matriz?.anio_ref ?? 2026;
  const anioPrev = matriz?.anio_prev ?? 2025;
  const mesesCur =
    matriz?.filas.map((f) => f.valores[String(anioCur)] ?? 0) ??
    Array(12).fill(0);
  const mesesPrev =
    matriz?.filas.map((f) => f.valores[String(anioPrev)] ?? 0) ??
    Array(12).fill(0);

  const fechaLabel = kpis?.fecha
    ? new Date(kpis.fecha + "T12:00:00").toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : fecha;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1.5 text-[11.5px] font-bold tracking-[0.08em] text-sr-green">
            COMERCIAL · BI
          </div>
          <h1 className="mb-2 font-display text-[28px] font-bold leading-tight sm:text-[30px]">
            Dashboard de ventas
          </h1>
          <p className="max-w-[640px] text-[13.5px] leading-normal text-sr-ink/45">
            Una sola fuente: <code className="text-[12px]">v_ventas</code>{" "}
            (NC netean · sin conceptos/merchandising). Números validados contra
            el diario; diferencias con Power BI en el panel de conciliación.
          </p>
        </div>
        <div
          className={`mt-1 flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold ${
            error ? "text-sr-ink/45" : "text-sr-green"
          }`}
        >
          <span
            className={`h-[7px] w-[7px] rounded-full ${
              error ? "bg-sr-ink/30" : "bg-sr-green-light"
            }`}
          />
          {error ? "sin datos" : "v_ventas"}
        </div>
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {/* Filtros: colapsables en mobile (como explorador) */}
      <details open className="rounded-2xl border border-sr-mist bg-white shadow-card">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-sr-ink md:hidden">
          Filtros · {empresaLabel(empresa)} · {moneda}
          <span className="text-xs font-medium text-sr-ink/45">Mostrar / ocultar</span>
        </summary>
        <form
          method="get"
          className="grid grid-cols-2 gap-3 border-t border-sr-mist px-4 py-4 sm:grid-cols-3 md:border-0 lg:grid-cols-6"
        >
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-sr-ink/45">
            Empresa
            <select
              name="empresa"
              defaultValue={empresa}
              className="rounded-lg border border-sr-mist bg-sr-sand/40 px-2.5 py-2 text-sm font-medium text-sr-ink"
            >
              <option value="todas">Todas</option>
              <option value="3">Sure Rain</option>
              <option value="5">Angus</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-sr-ink/45">
            Moneda
            <select
              name="moneda"
              defaultValue={moneda}
              className="rounded-lg border border-sr-mist bg-sr-sand/40 px-2.5 py-2 text-sm font-medium text-sr-ink"
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-sr-ink/45">
            Fecha
            <input
              type="date"
              name="fecha"
              defaultValue={fecha}
              className="rounded-lg border border-sr-mist bg-sr-sand/40 px-2.5 py-2 text-sm font-medium text-sr-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-sr-ink/45">
            Vendedor
            <select
              name="vendedor"
              defaultValue={vendedor ?? "all"}
              className="rounded-lg border border-sr-mist bg-sr-sand/40 px-2.5 py-2 text-sm font-medium text-sr-ink"
            >
              <option value="all">Todos</option>
              {dimensiones.vendedores.map((v) => (
                <option key={v.cod_vendedor} value={v.cod_vendedor}>
                  {v.vendedor}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-sr-ink/45">
            Familia
            <select
              name="familia"
              defaultValue={familia ?? "all"}
              className="rounded-lg border border-sr-mist bg-sr-sand/40 px-2.5 py-2 text-sm font-medium text-sr-ink"
            >
              <option value="all">Todas</option>
              {dimensiones.familias.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-sr-ink/45">
            Ranking por
            <select
              name="periodo"
              defaultValue={periodoRanking}
              className="rounded-lg border border-sr-mist bg-sr-sand/40 px-2.5 py-2 text-sm font-medium text-sr-ink"
            >
              <option value="mes">Mes</option>
              <option value="anio">Año</option>
            </select>
          </label>
          <div className="col-span-2 flex items-end sm:col-span-3 lg:col-span-6">
            <button
              type="submit"
              className="inline-flex min-h-10 items-center rounded-lg bg-sr-green px-4 text-sm font-semibold text-white hover:bg-sr-green-dark"
            >
              Aplicar filtros
            </button>
          </div>
        </form>
      </details>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Venta del día"
          value={kpis ? fmtMoney(kpis.venta_dia, moneda) : "—"}
          sub={
            kpis
              ? `${fmtMoneyCompact(kpis.venta_dia_alt, kpis.moneda_alt)} · ${fechaLabel}`
              : "—"
          }
        />
        <KpiCard
          label="Venta del mes"
          value={kpis ? fmtMoney(kpis.venta_mes, moneda) : "—"}
          sub={
            kpis
              ? `${fmtMoneyCompact(kpis.venta_mes_alt, kpis.moneda_alt)} · ${MES_LABELS[(kpis.mes || 1) - 1]} ${kpis.anio}`
              : "—"
          }
        />
        <KpiCard
          dark
          label="Venta del año"
          value={kpis ? fmtMoneyCompact(kpis.venta_anio, moneda) : "—"}
          sub={
            kpis
              ? `${fmtMoneyCompact(kpis.venta_anio_alt, kpis.moneda_alt)} · ene–${MES_LABELS[(kpis.mes || 1) - 1]} ${kpis.anio}`
              : "—"
          }
        />
      </div>

      {/* Por empresa */}
      <div className="rounded-2xl border border-sr-mist bg-white p-[18px] shadow-card sm:p-[22px]">
        <h2 className="mb-1 font-display text-[15.5px] font-bold">
          Por empresa
        </h2>
        <p className="mb-4 text-[12.5px] text-sr-ink/45">
          Día / mes / año al {fechaLabel} · {moneda}
        </p>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-sr-mist text-[11.5px] font-semibold text-sr-ink/45">
                <th className="pb-2.5 pr-3">Empresa</th>
                <th className="pb-2.5 pr-3 text-right">Día</th>
                <th className="pb-2.5 pr-3 text-right">%</th>
                <th className="pb-2.5 pr-3 text-right">Mes</th>
                <th className="pb-2.5 pr-3 text-right">%</th>
                <th className="pb-2.5 pr-3 text-right">Año</th>
                <th className="pb-2.5 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <tr
                  key={e.empresa}
                  className="border-b border-[#f1f3f1] last:border-0"
                >
                  <td className="py-2.5 pr-3 font-semibold">{e.nombre}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {fmtMoney(e.venta_dia, moneda)}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-sr-ink/45 tabular-nums">
                    {e.pct_dia.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%
                  </td>
                  <td className="py-2.5 pr-3 text-right font-semibold text-sr-green-light tabular-nums">
                    {fmtMoney(e.venta_mes, moneda)}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-sr-ink/45 tabular-nums">
                    {e.pct_mes.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {fmtMoneyCompact(e.venta_anio, moneda)}
                  </td>
                  <td className="py-2.5 text-right text-sr-ink/45 tabular-nums">
                    {e.pct_anio.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%
                  </td>
                </tr>
              ))}
              {empresas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sr-ink/45">
                    Sin datos
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Matriz */}
      <div className="rounded-2xl border border-sr-mist bg-white p-[18px] shadow-card sm:p-[22px]">
        <h2 className="mb-1 font-display text-[15.5px] font-bold">
          Ventas por mes y año
        </h2>
        <p className="mb-4 text-[12.5px] text-sr-ink/45">
          {empresaLabel(empresa)} · {moneda} · Δ vs {anioPrev}
        </p>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[12.5px] sm:text-sm">
            <thead>
              <tr className="border-b border-sr-mist text-[11px] font-semibold uppercase tracking-wide text-sr-ink/45">
                <th className="sticky left-0 bg-white pb-2.5 pr-3">Mes</th>
                {(matriz?.anios ?? [2022, 2023, 2024, 2025, 2026]).map((y) => (
                  <th key={y} className="pb-2.5 px-2 text-right">
                    {y}
                  </th>
                ))}
                <th className="pb-2.5 px-2 text-right">Δ mes</th>
                <th className="pb-2.5 pl-2 text-right">Δ acum.</th>
              </tr>
            </thead>
            <tbody>
              {(matriz?.filas ?? []).map((fila) => (
                <tr
                  key={fila.mes}
                  className="border-b border-[#f1f3f1] last:border-0"
                >
                  <td className="sticky left-0 bg-white py-2 pr-3 font-medium">
                    {MES_LABELS[fila.mes - 1]}
                  </td>
                  {(matriz?.anios ?? []).map((y) => (
                    <td
                      key={y}
                      className="px-2 py-2 text-right tabular-nums text-sr-ink/80"
                    >
                      {fmtMoneyCompact(fila.valores[String(y)] ?? 0, moneda)}
                    </td>
                  ))}
                  <td
                    className={`px-2 py-2 text-right font-semibold tabular-nums ${deltaClass(fila.delta_mes_pct)}`}
                  >
                    {fmtPct(fila.delta_mes_pct)}
                  </td>
                  <td
                    className={`py-2 pl-2 text-right font-semibold tabular-nums ${deltaClass(fila.delta_acum_pct)}`}
                  >
                    {fmtPct(fila.delta_acum_pct)}
                  </td>
                </tr>
              ))}
              {matriz?.total ? (
                <tr className="border-t-2 border-sr-mist bg-sr-sand/30 font-semibold">
                  <td className="sticky left-0 bg-sr-sand/30 py-2.5 pr-3">
                    Total
                  </td>
                  {(matriz.anios ?? []).map((y) => (
                    <td key={y} className="px-2 py-2.5 text-right tabular-nums">
                      {fmtMoneyCompact(matriz.total.valores[String(y)] ?? 0, moneda)}
                    </td>
                  ))}
                  <td
                    className={`px-2 py-2.5 text-right tabular-nums ${deltaClass(matriz.total.delta_mes_pct)}`}
                  >
                    {fmtPct(matriz.total.delta_mes_pct)}
                  </td>
                  <td
                    className={`py-2.5 pl-2 text-right tabular-nums ${deltaClass(matriz.total.delta_acum_pct)}`}
                  >
                    {fmtPct(matriz.total.delta_acum_pct)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <ComercialCharts
        moneda={moneda}
        anioCur={anioCur}
        anioPrev={anioPrev}
        mesesCur={mesesCur}
        mesesPrev={mesesPrev}
        ranking={ranking}
      />

      {/* Ranking table / mobile list */}
      <div className="rounded-2xl border border-sr-mist bg-white p-[18px] shadow-card sm:p-[22px]">
        <h2 className="mb-1 font-display text-[15.5px] font-bold">
          Ranking de vendedores
        </h2>
        <p className="mb-4 text-[12.5px] text-sr-ink/45">
          % del mes y % del año · ordenado por {periodoRanking === "anio" ? "año" : "mes"}
        </p>

        {/* Mobile list */}
        <ul className="space-y-3 md:hidden">
          {ranking.map((r, i) => (
            <li
              key={`${r.cod_vendedor}-${i}`}
              className="rounded-xl border border-sr-mist bg-sr-sand/20 px-3 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-sr-sand text-[11px] font-bold text-sr-ink/45">
                      {i + 1}
                    </span>
                    <span className="truncate font-semibold">{r.vendedor}</span>
                  </div>
                  <div className="mt-1.5 text-[12px] text-sr-ink/45">
                    Mes {fmtMoneyCompact(r.venta_mes, moneda)} · Año{" "}
                    {fmtMoneyCompact(r.venta_anio, moneda)}
                  </div>
                </div>
                <div className="shrink-0 text-right text-[12px]">
                  <div className="font-semibold text-sr-green-light">
                    {r.pct_mes.toLocaleString("es-AR", { maximumFractionDigits: 1 })}% mes
                  </div>
                  <div className="text-sr-ink/45">
                    {r.pct_anio.toLocaleString("es-AR", { maximumFractionDigits: 1 })}% año
                  </div>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sr-mist">
                <div
                  className="h-full rounded-full bg-sr-green"
                  style={{ width: `${Math.min(100, Math.max(0, r.pct_mes))}%` }}
                />
              </div>
            </li>
          ))}
          {ranking.length === 0 ? (
            <li className="py-4 text-center text-sm text-sr-ink/45">Sin datos</li>
          ) : null}
        </ul>

        {/* Desktop table */}
        <div className="-mx-1 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-sr-mist text-[11.5px] font-semibold text-sr-ink/45">
                <th className="pb-2.5 pr-2 text-left">#</th>
                <th className="pb-2.5 pr-3 text-left">Vendedor</th>
                <th className="pb-2.5 pr-3 text-right">Mes</th>
                <th className="pb-2.5 pr-3 text-right">% mes</th>
                <th className="pb-2.5 pr-3 text-right">Año</th>
                <th className="pb-2.5 text-right">% año</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr
                  key={`${r.cod_vendedor}-${i}`}
                  className="border-b border-[#f1f3f1] last:border-0"
                >
                  <td className="py-2.5 pr-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-sr-sand text-[11px] font-bold text-sr-ink/45">
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 font-medium">{r.vendedor}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {fmtMoney(r.venta_mes, moneda)}
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    <span className="mr-2 inline-block h-1.5 w-[70px] overflow-hidden rounded-md bg-sr-mist align-middle">
                      <span
                        className="block h-full rounded-md bg-sr-green"
                        style={{
                          width: `${Math.min(100, Math.max(0, r.pct_mes))}%`,
                        }}
                      />
                    </span>
                    <span className="text-xs text-sr-ink/45">
                      {r.pct_mes.toLocaleString("es-AR", {
                        maximumFractionDigits: 1,
                      })}
                      %
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-semibold text-sr-green-light tabular-nums">
                    {fmtMoneyCompact(r.venta_anio, moneda)}
                  </td>
                  <td className="py-2.5 text-right text-sr-ink/45 tabular-nums">
                    {r.pct_anio.toLocaleString("es-AR", {
                      maximumFractionDigits: 1,
                    })}
                    %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conciliación */}
      <details className="rounded-2xl border border-amber-200/80 bg-amber-50/40 open:shadow-card">
        <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-semibold text-sr-ink sm:px-5">
          Conciliación con sus informes
          <span className="ml-2 text-[11.5px] font-medium text-sr-ink/45">
            alineamos criterios juntos
          </span>
        </summary>
        <div className="space-y-3 border-t border-amber-200/60 px-4 py-4 text-[13px] leading-relaxed text-sr-ink/75 sm:px-5">
          <p className="flex gap-2">
            <span className="shrink-0 text-sr-green-light" aria-hidden>
              ✓
            </span>
            <span>
              Validado contra el informe diario: coincide al peso (ej. Fabian ·
              Sure · agosto = <strong>$121.023.216</strong>).
            </span>
          </p>
          <p className="flex gap-2">
            <span className="shrink-0 text-amber-600" aria-hidden>
              ⚠
            </span>
            <span>
              Algunos totales difieren del tablero Power BI y están en revisión
              conjunta:
            </span>
          </p>
          <ul className="ml-6 list-disc space-y-1.5 text-[12.5px] text-sr-ink/65">
            <li>
              El “Ventas del mes” de Fabian en el Power BI figura ~$37M vs $121M
              en el diario — a confirmar si había un filtro activo.
            </li>
            <li>
              Pendiente: corte sin filtros por vendedor × empresa × mes para
              calibrar.
            </li>
            <li>Definir qué incluye “merchandising” en su modelo.</li>
            <li>
              Abril 2023 (Sure) da negativo por una nota de crédito grande — a
              revisar.
            </li>
          </ul>
          <p className="text-[12px] text-sr-ink/45">
            Este tablero muestra nuestros números reales desde Tango (
            <code className="text-[11px]">v_ventas</code>
            ). No se forzó ningún total para igualar Power BI.
          </p>
        </div>
      </details>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  dark,
}: {
  label: string;
  value: string;
  sub: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border p-[18px] shadow-card ${
        dark ? "border-sr-ink bg-sr-ink" : "border-sr-mist bg-white"
      }`}
    >
      <div
        className={`text-[11.5px] font-semibold uppercase tracking-[0.06em] ${
          dark ? "text-[#a9b3ac]" : "text-sr-ink/45"
        }`}
      >
        {label}
      </div>
      <div
        className={`font-display text-[24px] font-bold leading-tight sm:text-[26px] ${
          dark ? "text-white" : "text-sr-ink"
        }`}
      >
        {value}
      </div>
      <div className={`text-[12px] ${dark ? "text-[#8f9993]" : "text-sr-ink/45"}`}>
        {sub}
      </div>
    </div>
  );
}
