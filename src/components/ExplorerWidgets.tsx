"use client";

import type { ExplorerMetric, ExplorerRow } from "@/lib/commercial/explorer-format";
import { formatExplorerValue } from "@/lib/commercial/explorer-format";

export function ExplorerBars({
  rows,
  metric,
}: {
  rows: ExplorerRow[];
  metric: ExplorerMetric;
}) {
  const top = rows.slice(0, 12);
  const max = Math.max(...top.map((r) => Math.abs(r.valor)), 1);

  if (!top.length) return null;

  return (
    <div className="rounded-xl border border-black/5 bg-white p-4">
      <h2 className="font-display text-lg font-semibold text-sr-ink">Gráfico</h2>
      <ul className="mt-4 space-y-2">
        {top.map((r) => {
          const pct = Math.min(100, (Math.abs(r.valor) / max) * 100);
          return (
            <li key={r.dimension} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm">
              <span className="truncate text-sr-ink/70" title={r.dimension}>
                {r.dimension}
              </span>
              <div className="h-3 overflow-hidden rounded bg-sr-mist">
                <div
                  className="h-full rounded bg-sr-green/80"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="tabular-nums text-sr-ink/80">
                {formatExplorerValue(metric, r.valor)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ExplorerCsvButton({
  csv,
  filename,
}: {
  csv: string;
  filename: string;
}) {
  function download() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" onClick={download} className="btn-secondary !min-h-10">
      Exportar CSV
    </button>
  );
}
