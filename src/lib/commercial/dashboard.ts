import { createCommercialServerClient } from "@/lib/supabase/commercial/server";

export type DashboardMensual = { mes: string; facturado: number };
export type DashboardFamilia = {
  familia: string;
  facturado: number;
  unidades: number;
};
export type DashboardCliente = { cliente: string; facturado: number };

export type DashboardSummary = {
  facturacion_30d: number;
  facturacion_30d_prev: number;
  comprobantes_30d: number;
  comprobantes_30d_prev: number;
  clientes_30d: number;
  facturacion_12m: number;
  facturacion_12m_prev: number;
  clientes_activos: number;
  productos_con_stock: number;
  productos_activos: number;
  facturacion_mensual: DashboardMensual[];
  top_familias: DashboardFamilia[];
  top_clientes: DashboardCliente[];
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function parseSummary(raw: unknown): DashboardSummary {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    facturacion_30d: num(o.facturacion_30d),
    facturacion_30d_prev: num(o.facturacion_30d_prev),
    comprobantes_30d: num(o.comprobantes_30d),
    comprobantes_30d_prev: num(o.comprobantes_30d_prev),
    clientes_30d: num(o.clientes_30d),
    facturacion_12m: num(o.facturacion_12m),
    facturacion_12m_prev: num(o.facturacion_12m_prev),
    clientes_activos: num(o.clientes_activos),
    productos_con_stock: num(o.productos_con_stock),
    productos_activos: num(o.productos_activos),
    facturacion_mensual: asArray(o.facturacion_mensual).map((row) => {
      const r = (row && typeof row === "object" ? row : {}) as Record<
        string,
        unknown
      >;
      return { mes: String(r.mes ?? ""), facturado: num(r.facturado) };
    }),
    top_familias: asArray(o.top_familias).map((row) => {
      const r = (row && typeof row === "object" ? row : {}) as Record<
        string,
        unknown
      >;
      return {
        familia: String(r.familia ?? "Sin familia"),
        facturado: num(r.facturado),
        unidades: num(r.unidades),
      };
    }),
    top_clientes: asArray(o.top_clientes).map((row) => {
      const r = (row && typeof row === "object" ? row : {}) as Record<
        string,
        unknown
      >;
      return {
        cliente: String(r.cliente ?? "—"),
        facturado: num(r.facturado),
      };
    }),
  };
}

/** Admin-gated in DB (security definer). Caller must already be behind admin UI. */
export async function fetchDashboardSummary(): Promise<
  { data: DashboardSummary; error: null } | { data: null; error: string }
> {
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase.rpc("dashboard_summary");
  if (error) {
    return { data: null, error: error.message };
  }
  return { data: parseSummary(data), error: null };
}

export function pctChange(
  current: number,
  prev: number,
): { pct: number | null; tone: "up" | "down" | "neutral" } {
  if (prev === 0) {
    if (current === 0) return { pct: 0, tone: "neutral" };
    return { pct: null, tone: "up" };
  }
  const pct = ((current - prev) / prev) * 100;
  if (pct > 0.05) return { pct, tone: "up" };
  if (pct < -0.05) return { pct, tone: "down" };
  return { pct: 0, tone: "neutral" };
}

export function formatPctDelta(
  current: number,
  prev: number,
  vsLabel: string,
): { text: string; tone: "up" | "down" | "neutral" } {
  const { pct, tone } = pctChange(current, prev);
  if (pct === null) {
    return { text: `↑ nuevo vs ${vsLabel}`, tone: "up" };
  }
  const abs = Math.abs(pct).toLocaleString("es-AR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
  if (tone === "up") return { text: `↑ +${abs}% vs ${vsLabel}`, tone };
  if (tone === "down") return { text: `↓ -${abs}% vs ${vsLabel}`, tone };
  return { text: `= 0,0% vs ${vsLabel}`, tone: "neutral" };
}

const MES_CORTO = [
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

/** "YYYY-MM" → "Sep" */
export function mesCortoLabel(yyyyMm: string): string {
  const m = Number(yyyyMm.slice(5, 7));
  if (!Number.isFinite(m) || m < 1 || m > 12) return yyyyMm;
  return MES_CORTO[m - 1]!;
}

export const FAMILIA_COLORS = [
  "#006A46",
  "#0A8A5C",
  "#4CA985",
  "#9CC7B4",
  "#D3E4DA",
] as const;
