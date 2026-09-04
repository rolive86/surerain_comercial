export type EmpresaFilter = "3" | "5" | "todas";
export type MonedaFilter = "ARS" | "USD";

export type RankingRow = {
  cod_vendedor: string | null;
  vendedor: string;
  venta_mes: number;
  venta_anio: number;
  pct_mes: number;
  pct_anio: number;
};

export function fmtMoney(n: number, moneda: MonedaFilter = "ARS"): string {
  const prefix = moneda === "USD" ? "US$" : "$";
  return prefix + Math.round(n).toLocaleString("es-AR");
}

export function fmtMoneyCompact(n: number, moneda: MonedaFilter = "ARS"): string {
  const prefix = moneda === "USD" ? "US$" : "$";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return (
      prefix +
      (n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) +
      "M"
    );
  }
  return fmtMoney(n, moneda);
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n).toLocaleString("es-AR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
  if (n > 0.05) return `+${abs}%`;
  if (n < -0.05) return `−${abs}%`;
  return `${abs}%`;
}

export const MES_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

export function empresaLabel(code: string): string {
  if (code === "3") return "Sure Rain";
  if (code === "5") return "Angus";
  if (code === "todas") return "Todas";
  return code;
}
