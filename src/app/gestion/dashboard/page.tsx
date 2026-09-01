import {
  FAMILIA_COLORS,
  fetchDashboardSummary,
  formatPctDelta,
  mesCortoLabel,
  type DashboardSummary,
} from "@/lib/commercial/dashboard";
import { DashboardCharts } from "./DashboardCharts";

export const dynamic = "force-dynamic";

function fmtARS(n: number) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

function fmtCompact(n: number) {
  return (
    "$" +
    (n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) +
    "M"
  );
}

function fmtInt(n: number) {
  return Math.round(n).toLocaleString("es-AR");
}

export default async function DashboardPage() {
  const result = await fetchDashboardSummary();
  const data = result.data;
  const error = result.error;

  return (
    <main className="flex-1 overflow-x-hidden px-8 py-7">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-1.5 text-[11.5px] font-bold tracking-[0.08em] text-sr-green">
            RESUMEN
          </div>
          <h1 className="mb-2 font-display text-[30px] font-bold">Dashboard</h1>
          <p className="max-w-[600px] text-[13.5px] leading-normal text-sr-ink/45">
            Indicadores comerciales en tiempo real — facturación, clientes y
            catálogo. Datos sincronizados desde Tango ERP. Visible solo para el
            rol Admin.
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
          {error ? "sin datos" : "conectado"}
        </div>
      </div>

      {error ? (
        <p
          className="mb-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <DashboardBody data={data} />
    </main>
  );
}

function DashboardBody({ data }: { data: DashboardSummary | null }) {
  const fact30d = data?.facturacion_30d ?? 0;
  const fact12m = data?.facturacion_12m ?? 0;
  const delta30 = formatPctDelta(
    fact30d,
    data?.facturacion_30d_prev ?? 0,
    "30 días previos",
  );
  const deltaComp = formatPctDelta(
    data?.comprobantes_30d ?? 0,
    data?.comprobantes_30d_prev ?? 0,
    "30 días previos",
  );
  const delta12m = formatPctDelta(
    fact12m,
    data?.facturacion_12m_prev ?? 0,
    "12 meses previos",
  );

  const mensual = data?.facturacion_mensual ?? [];
  const meses = mensual.map((m) => mesCortoLabel(m.mes));
  const facturacionMensual = mensual.map((m) => m.facturado);

  const familias = data?.top_familias ?? [];
  const clientes = data?.top_clientes ?? [];
  const totalFam = familias.reduce((a, f) => a + f.facturado, 0);
  const maxCli = clientes[0]?.facturado ?? 0;

  return (
    <>
      <div className="mb-5 grid grid-cols-5 gap-4 max-[1180px]:grid-cols-3">
        <KpiCard
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          }
          value={data ? fmtARS(fact30d) : "—"}
          label="Facturación (30 días)"
          delta={data ? delta30.text : "—"}
          deltaTone={data ? delta30.tone : "neutral"}
        />
        <KpiCard
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="3" width="16" height="18" rx="2" />
              <path d="M9 3v2h6V3M8 11h8M8 15h5" />
            </svg>
          }
          value={data ? fmtInt(data.comprobantes_30d) : "—"}
          label="Comprobantes (30 días)"
          delta={data ? deltaComp.text : "—"}
          deltaTone={data ? deltaComp.tone : "neutral"}
        />
        <KpiCard
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2 20c0-3.6 3-5.8 7-5.8s7 2.2 7 5.8M16 8.2c1.8.2 3 1.4 3 3M17.5 20c0-2.6-1.4-4.4-3.5-5.3" />
            </svg>
          }
          value={data ? fmtInt(data.clientes_activos) : "—"}
          label="Clientes activos"
          delta={
            data
              ? `${fmtInt(data.clientes_30d)} compraron en 30 días`
              : "—"
          }
          deltaTone="neutral"
        />
        <KpiCard
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 8L12 3 3 8l9 5 9-5z" />
              <path d="M3 8v8l9 5 9-5V8" />
            </svg>
          }
          value={data ? fmtInt(data.productos_con_stock) : "—"}
          label="Productos con stock"
          delta={
            data ? `de ${fmtInt(data.productos_activos)} activos` : "—"
          }
          deltaTone="neutral"
        />
        <KpiCard
          dark
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 17l6-6 4 4 8-8" />
              <path d="M15 7h6v6" />
            </svg>
          }
          value={data ? fmtCompact(fact12m) : "—"}
          label="Facturación (12 meses)"
          delta={data ? delta12m.text : "—"}
          deltaTone={data ? delta12m.tone : "neutral"}
        />
      </div>

      <div className="mb-4 grid grid-cols-[1.15fr_.85fr] gap-4 max-[1180px]:grid-cols-1">
        {meses.length > 0 ? (
          <DashboardCharts
            meses={meses}
            facturacionMensual={facturacionMensual}
          />
        ) : (
          <>
            <EmptyPanel title="Facturación por mes" />
            <EmptyPanel title="Facturación acumulada" />
          </>
        )}
      </div>

      <div className="grid grid-cols-[1.15fr_.85fr] gap-4 max-[1180px]:grid-cols-1">
        <div className="rounded-2xl border border-sr-mist bg-white p-[22px] shadow-card">
          <h2 className="mb-1 font-display text-[15.5px] font-bold">
            Por familia de producto
          </h2>
          <div className="mb-4 font-sans text-[12.5px] font-normal text-sr-ink/45">
            últimos 12 meses
          </div>
          {familias.length === 0 ? (
            <p className="text-sm text-sr-ink/45">Sin datos de familias.</p>
          ) : (
            <table className="w-full border-collapse font-sans">
              <thead>
                <tr>
                  <th className="border-b border-sr-mist pb-2.5 text-left text-[11.5px] font-semibold text-sr-ink/45">
                    Familia
                  </th>
                  <th className="border-b border-sr-mist pb-2.5 text-left text-[11.5px] font-semibold text-sr-ink/45">
                    Facturado
                  </th>
                  <th className="border-b border-sr-mist pb-2.5 text-left text-[11.5px] font-semibold text-sr-ink/45">
                    Unidades
                  </th>
                  <th className="border-b border-sr-mist pb-2.5 text-left text-[11.5px] font-semibold text-sr-ink/45">
                    Participación
                  </th>
                </tr>
              </thead>
              <tbody>
                {familias.map((f, i) => {
                  const pct =
                    totalFam > 0
                      ? ((f.facturado / totalFam) * 100).toFixed(1)
                      : "0.0";
                  const color =
                    FAMILIA_COLORS[i % FAMILIA_COLORS.length] ?? "#006A46";
                  return (
                    <tr
                      key={f.familia}
                      className="border-b border-[#f1f3f1] last:border-b-0"
                    >
                      <td className="py-[11px] align-middle text-[13px]">
                        <span
                          className="mr-2 inline-block h-[9px] w-[9px] rounded-[3px]"
                          style={{ background: color }}
                        />
                        {f.familia}
                      </td>
                      <td className="py-[11px] align-middle text-[13px]">
                        {fmtARS(f.facturado)}
                      </td>
                      <td className="py-[11px] align-middle text-[13px]">
                        {f.unidades.toLocaleString("es-AR")}
                      </td>
                      <td className="py-[11px] align-middle text-[13px]">
                        <span className="mr-2 inline-block h-1.5 w-[100px] overflow-hidden rounded-md bg-sr-mist align-middle">
                          <span
                            className="block h-full rounded-md bg-sr-green"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="text-xs text-sr-ink/45">{pct}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-2xl border border-sr-mist bg-white p-[22px] shadow-card">
          <h2 className="mb-1 font-display text-[15.5px] font-bold">
            Top clientes
          </h2>
          <div className="mb-4 font-sans text-[12.5px] font-normal text-sr-ink/45">
            últimos 12 meses
          </div>
          {clientes.length === 0 ? (
            <p className="text-sm text-sr-ink/45">Sin datos de clientes.</p>
          ) : (
            <table className="w-full border-collapse font-sans">
              <thead>
                <tr>
                  <th className="border-b border-sr-mist pb-2.5 text-left text-[11.5px] font-semibold text-sr-ink/45">
                    #
                  </th>
                  <th className="border-b border-sr-mist pb-2.5 text-left text-[11.5px] font-semibold text-sr-ink/45">
                    Cliente
                  </th>
                  <th className="border-b border-sr-mist pb-2.5 text-left text-[11.5px] font-semibold text-sr-ink/45">
                    Facturado
                  </th>
                  <th className="border-b border-sr-mist pb-2.5 text-left text-[11.5px] font-semibold text-sr-ink/45">
                    Part.
                  </th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c, i) => {
                  const pct =
                    fact12m > 0
                      ? ((c.facturado / fact12m) * 100).toFixed(1)
                      : "0.0";
                  const barPct =
                    maxCli > 0
                      ? ((c.facturado / maxCli) * 100).toFixed(0)
                      : "0";
                  return (
                    <tr
                      key={c.cliente}
                      className="border-b border-[#f1f3f1] last:border-b-0"
                    >
                      <td className="py-[11px] align-middle text-[13px]">
                        <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-md bg-sr-sand text-[11px] font-bold text-sr-ink/45">
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-[11px] align-middle text-[13px]">
                        {c.cliente}
                      </td>
                      <td className="py-[11px] align-middle text-[13px] font-semibold text-sr-green-light">
                        {fmtARS(c.facturado)}
                      </td>
                      <td className="py-[11px] align-middle text-[13px]">
                        <span className="mr-2 inline-block h-1.5 w-[70px] overflow-hidden rounded-md bg-sr-mist align-middle">
                          <span
                            className="block h-full rounded-md bg-sr-green"
                            style={{ width: `${barPct}%` }}
                          />
                        </span>
                        <span className="text-xs text-sr-ink/45">{pct}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

function EmptyPanel({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-sr-mist bg-white p-[22px] shadow-card">
      <h2 className="mb-1 font-display text-[15.5px] font-bold">{title}</h2>
      <div className="mb-4 font-sans text-[12.5px] font-normal text-sr-ink/45">
        últimos 12 meses
      </div>
      <div className="flex h-[225px] items-center justify-center text-sm text-sr-ink/45">
        Sin datos
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  value,
  label,
  delta,
  deltaTone,
  dark,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  delta: string;
  deltaTone: "up" | "down" | "neutral";
  dark?: boolean;
}) {
  const deltaClass =
    deltaTone === "up"
      ? dark
        ? "bg-[rgba(10,138,92,0.2)] text-[#4fd394]"
        : "bg-[#e6f3ec] text-sr-green-light"
      : deltaTone === "down"
        ? dark
          ? "bg-red-500/20 text-red-300"
          : "bg-red-50 text-red-700"
        : "bg-sr-mist text-sr-ink/45";

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-[18px] shadow-card ${
        dark ? "border-sr-ink bg-sr-ink" : "border-sr-mist bg-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full ${
            dark
              ? "bg-[#232f28] text-sr-green-light"
              : "bg-sr-sand text-sr-green"
          }`}
        >
          {icon}
        </div>
        <div>
          <div
            className={`font-display text-[21px] font-bold leading-tight ${
              dark ? "text-white" : "text-sr-ink"
            }`}
          >
            {value}
          </div>
          <div
            className={`mt-0.5 font-sans text-xs ${
              dark ? "text-[#a9b3ac]" : "text-sr-ink/45"
            }`}
          >
            {label}
          </div>
        </div>
      </div>
      <div
        className={`inline-flex items-center gap-1 self-start rounded-full px-2.5 py-1 font-sans text-[11.5px] font-semibold ${deltaClass}`}
      >
        {delta}
      </div>
    </div>
  );
}
