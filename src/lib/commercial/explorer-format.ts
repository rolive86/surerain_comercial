export type ExplorerMetric =
  | "cantidad"
  | "facturacion"
  | "comprobantes"
  | "clientes";

export type ExplorerRow = {
  dimension: string;
  valor: number;
  valor_anio_anterior: number | null;
  variacion_pct: number | null;
};

export function formatExplorerValue(metric: ExplorerMetric, n: number): string {
  if (metric === "facturacion") {
    return n.toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    });
  }
  return n.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}

export function rowsToCsv(
  rows: ExplorerRow[],
  metric: ExplorerMetric,
  interanual: boolean,
): string {
  const headers = interanual
    ? ["dimension", metric, "anio_anterior", "variacion_pct"]
    : ["dimension", metric];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const base = [`"${r.dimension.replace(/"/g, '""')}"`, String(r.valor)];
    if (interanual) {
      base.push(
        r.valor_anio_anterior == null ? "" : String(r.valor_anio_anterior),
        r.variacion_pct == null ? "" : String(r.variacion_pct),
      );
    }
    lines.push(base.join(","));
  }
  return lines.join("\n");
}
