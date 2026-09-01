"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
);

const SR_GREEN = "#006A46";
const SR_MIST = "#E7EEE9";

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

const scaleOptions = {
  y: {
    ticks: {
      callback: (value: string | number) => fmtCompact(Number(value)),
      font: { size: 11 },
    },
    grid: { color: SR_MIST },
  },
  x: {
    grid: { display: false },
    ticks: { font: { size: 11 } },
  },
} as const;

const sharedOptions: ChartOptions<"bar" | "line"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => fmtARS(ctx.parsed.y ?? 0),
      },
    },
  },
  scales: scaleOptions,
};

type Props = {
  meses: string[];
  facturacionMensual: number[];
};

export function DashboardCharts({ meses, facturacionMensual }: Props) {
  let acc = 0;
  const acumulada = facturacionMensual.map((v) => (acc += v));

  return (
    <>
      <div className="rounded-2xl border border-sr-mist bg-white p-[22px] shadow-card">
        <h2 className="mb-1 font-display text-[15.5px] font-bold">
          Facturación por mes
        </h2>
        <div className="mb-4 font-sans text-[12.5px] font-normal text-sr-ink/45">
          últimos 12 meses
        </div>
        <div className="h-[225px]">
          <Bar
            data={{
              labels: meses,
              datasets: [
                {
                  label: "Facturación (ARS)",
                  data: facturacionMensual,
                  backgroundColor: SR_GREEN,
                  borderRadius: 4,
                  maxBarThickness: 28,
                },
              ],
            }}
            options={sharedOptions as ChartOptions<"bar">}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-sr-mist bg-white p-[22px] shadow-card">
        <h2 className="mb-1 font-display text-[15.5px] font-bold">
          Facturación acumulada
        </h2>
        <div className="mb-4 font-sans text-[12.5px] font-normal text-sr-ink/45">
          últimos 12 meses
        </div>
        <div className="h-[225px]">
          <Line
            data={{
              labels: meses,
              datasets: [
                {
                  label: "Facturación acumulada",
                  data: acumulada,
                  borderColor: SR_GREEN,
                  backgroundColor: "rgba(0,106,70,0.08)",
                  fill: true,
                  tension: 0.25,
                  pointRadius: 3,
                  pointBackgroundColor: SR_GREEN,
                },
              ],
            }}
            options={sharedOptions as ChartOptions<"line">}
          />
        </div>
      </div>
    </>
  );
}
