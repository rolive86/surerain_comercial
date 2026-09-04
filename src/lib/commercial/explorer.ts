import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { getCommercialSession } from "@/lib/commercial/session";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import { getTangoFamilias } from "@/lib/commercial/products-tango";
import { listIntelZones } from "@/lib/commercial/intel";
import type { ExplorerMetric, ExplorerRow } from "@/lib/commercial/explorer-format";

export type ExplorerGroupBy =
  | "cliente"
  | "localidad"
  | "provincia"
  | "familia"
  | "producto"
  | "vendedor"
  | "mes"
  | "anio";

export type { ExplorerMetric, ExplorerRow };
export {
  formatExplorerValue,
  rowsToCsv,
} from "@/lib/commercial/explorer-format";

export type ExplorerParams = {
  groupBy: ExplorerGroupBy;
  metric: ExplorerMetric;
  fechaDesde: string;
  fechaHasta: string;
  familia?: string;
  codArticulo?: string;
  localidad?: string;
  provincia?: string;
  compararInteranual: boolean;
};

const GROUP_WHITELIST = new Set<ExplorerGroupBy>([
  "cliente",
  "localidad",
  "provincia",
  "familia",
  "producto",
  "vendedor",
  "mes",
  "anio",
]);

const METRIC_WHITELIST = new Set<ExplorerMetric>([
  "cantidad",
  "facturacion",
  "comprobantes",
  "clientes",
]);

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function defaultYearRange(year = new Date().getFullYear()): {
  desde: string;
  hasta: string;
} {
  return {
    desde: `${year}-01-01`,
    hasta: `${year}-12-31`,
  };
}

export async function runVentasExplorer(
  params: ExplorerParams,
): Promise<ExplorerRow[]> {
  const session = await getCommercialSession();
  requireStaffSession(session);

  if (!GROUP_WHITELIST.has(params.groupBy)) {
    throw new Error("GROUP_BY_INVALID");
  }
  if (!METRIC_WHITELIST.has(params.metric)) {
    throw new Error("METRIC_INVALID");
  }

  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase.rpc("ventas_explorer", {
    p_group_by: params.groupBy,
    p_metric: params.metric,
    p_fecha_desde: params.fechaDesde,
    p_fecha_hasta: params.fechaHasta,
    p_familia: params.familia?.trim() || null,
    p_cod_articulo: params.codArticulo?.trim() || null,
    p_localidad: params.localidad?.trim() || null,
    p_provincia: params.provincia?.trim() || null,
    p_comparar_interanual: params.compararInteranual,
  });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    dimension: String(row.dimension ?? "—"),
    valor: num(row.valor),
    valor_anio_anterior: numOrNull(row.valor_anio_anterior),
    variacion_pct: numOrNull(row.variacion_pct),
  }));
}

export async function getExplorerOptions() {
  const [familias, zones] = await Promise.all([
    getTangoFamilias(),
    listIntelZones(),
  ]);
  return { familias, zones };
}

export function metricLabel(m: ExplorerMetric): string {
  switch (m) {
    case "cantidad":
      return "Cantidad";
    case "facturacion":
      return "Facturación";
    case "comprobantes":
      return "Nº comprobantes";
    case "clientes":
      return "Nº clientes";
  }
}

export function groupLabel(g: ExplorerGroupBy): string {
  switch (g) {
    case "cliente":
      return "Cliente";
    case "localidad":
      return "Localidad";
    case "provincia":
      return "Provincia";
    case "familia":
      return "Familia";
    case "producto":
      return "Producto";
    case "vendedor":
      return "Vendedor";
    case "mes":
      return "Mes";
    case "anio":
      return "Año";
  }
}
