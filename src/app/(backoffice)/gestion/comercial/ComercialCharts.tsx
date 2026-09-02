"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import {
  fmtMoney,
  fmtMoneyCompact,
  MES_LABELS,
  type MonedaFilter,
  type RankingRow,
} from "@/lib/commercial/comercial-dashboard-format";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const SR_GREEN = "#006A46";
const SR_GREEN_LIGHT = "#0A8A5C";
const SR_MIST = "#E7EEE9";

type Props = {
  moneda: MonedaFilter;
  anioCur: number;
  anioPrev: number;
  mesesCur: number[];
  mesesPrev: number[];
  ranking: RankingRow[];
};

export function ComercialCharts({
  moneda,
  anioCur,
  anioPrev,
  mesesCur,
  mesesPrev,
  ranking,
}: Props) {
  const labels = [...MES_LABELS];
  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: { boxWidth: 12, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx) =>
            `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y ?? 0, moneda)}`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (value) => fmtMoneyCompact(Number(value), moneda),
          font: { size: 11 },
        },
        grid: { color: SR_MIST },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
    },
  };

  const topVendors = ranking.slice(0, 8);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-sr-mist bg-white p-[22px] shadow-card">
        <h2 className="mb-1 font-display text-[15.5px] font-bold">
          Ventas por mes
        </h2>
        <div className="mb-4 font-sans text-[12.5px] text-sr-ink/45">
          {anioCur} vs {anioPrev}
        </div>
        <div className="h-[240px]">
          <Bar
            data={{
              labels,
              datasets: [
                {
                  label: String(anioPrev),
                  data: mesesPrev,
                  backgroundColor: SR_MIST,
                  borderRadius: 4,
                  maxBarThickness: 18,
                },
                {
                  label: String(anioCur),
                  data: mesesCur,
                  backgroundColor: SR_GREEN,
                  borderRadius: 4,
                  maxBarThickness: 18,
                },
              ],
            }}
            options={options}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-sr-mist bg-white p-[22px] shadow-card">
        <h2 className="mb-1 font-display text-[15.5px] font-bold">
          Ranking de vendedores
        </h2>
        <div className="mb-4 font-sans text-[12.5px] text-sr-ink/45">
          venta del mes ({moneda})
        </div>
        <div className="h-[240px]">
          {topVendors.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-sr-ink/45">
              Sin datos
            </div>
          ) : (
            <Bar
              data={{
                labels: topVendors.map((r) => r.vendedor),
                datasets: [
                  {
                    label: "Mes",
                    data: topVendors.map((r) => r.venta_mes),
                    backgroundColor: SR_GREEN_LIGHT,
                    borderRadius: 4,
                    maxBarThickness: 22,
                  },
                ],
              }}
              options={{
                ...options,
                indexAxis: "y",
                plugins: {
                  ...options.plugins,
                  legend: { display: false },
                },
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
