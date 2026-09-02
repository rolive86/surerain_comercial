import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import type {
  EmpresaFilter,
  MonedaFilter,
  RankingRow,
} from "@/lib/commercial/comercial-dashboard-format";

export type {
  EmpresaFilter,
  MonedaFilter,
  RankingRow,
} from "@/lib/commercial/comercial-dashboard-format";
export {
  empresaLabel,
  fmtMoney,
  fmtMoneyCompact,
  fmtPct,
  MES_LABELS,
} from "@/lib/commercial/comercial-dashboard-format";

export type ComercialKpis = {
  fecha: string;
  empresa: string;
  moneda: MonedaFilter;
  moneda_alt: MonedaFilter;
  venta_dia: number;
  venta_mes: number;
  venta_anio: number;
  venta_dia_alt: number;
  venta_mes_alt: number;
  venta_anio_alt: number;
  anio: number;
  mes: number;
};

export type MatrizFila = {
  mes: number;
  valores: Record<string, number>;
  delta_mes_pct: number | null;
  delta_acum_pct: number | null;
};

export type ComercialMatriz = {
  empresa: string;
  moneda: MonedaFilter;
  anios: number[];
  anio_ref: number;
  anio_prev: number;
  filas: MatrizFila[];
  total: {
    valores: Record<string, number>;
    delta_mes_pct: number | null;
    delta_acum_pct: number | null;
  };
};

export type EmpresaRow = {
  empresa: string;
  nombre: string;
  venta_dia: number;
  venta_mes: number;
  venta_anio: number;
  pct_dia: number;
  pct_mes: number;
  pct_anio: number;
};

export type ComercialDimensiones = {
  vendedores: Array<{ cod_vendedor: string; vendedor: string }>;
  familias: string[];
};

export type ComercialDashboardFilters = {
  empresa: EmpresaFilter;
  moneda: MonedaFilter;
  fecha: string;
  vendedor?: string;
  familia?: string;
  periodoRanking?: "mes" | "anio";
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function parseKpis(raw: unknown): ComercialKpis {
  const o = asObj(raw);
  return {
    fecha: String(o.fecha ?? ""),
    empresa: String(o.empresa ?? "todas"),
    moneda: String(o.moneda ?? "ARS").toUpperCase() === "USD" ? "USD" : "ARS",
    moneda_alt:
      String(o.moneda_alt ?? "USD").toUpperCase() === "ARS" ? "ARS" : "USD",
    venta_dia: num(o.venta_dia),
    venta_mes: num(o.venta_mes),
    venta_anio: num(o.venta_anio),
    venta_dia_alt: num(o.venta_dia_alt),
    venta_mes_alt: num(o.venta_mes_alt),
    venta_anio_alt: num(o.venta_anio_alt),
    anio: num(o.anio),
    mes: num(o.mes),
  };
}

function parseValores(v: unknown): Record<string, number> {
  const o = asObj(v);
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(o)) out[k] = num(val);
  return out;
}

function parseMatriz(raw: unknown): ComercialMatriz {
  const o = asObj(raw);
  const total = asObj(o.total);
  return {
    empresa: String(o.empresa ?? "todas"),
    moneda: String(o.moneda ?? "ARS").toUpperCase() === "USD" ? "USD" : "ARS",
    anios: asArray(o.anios).map((y) => num(y)),
    anio_ref: num(o.anio_ref) || 2026,
    anio_prev: num(o.anio_prev) || 2025,
    filas: asArray(o.filas).map((row) => {
      const r = asObj(row);
      return {
        mes: num(r.mes),
        valores: parseValores(r.valores),
        delta_mes_pct: numOrNull(r.delta_mes_pct),
        delta_acum_pct: numOrNull(r.delta_acum_pct),
      };
    }),
    total: {
      valores: parseValores(total.valores),
      delta_mes_pct: numOrNull(total.delta_mes_pct),
      delta_acum_pct: numOrNull(total.delta_acum_pct),
    },
  };
}

function parseRanking(raw: unknown): RankingRow[] {
  return asArray(raw).map((row) => {
    const r = asObj(row);
    return {
      cod_vendedor: r.cod_vendedor == null ? null : String(r.cod_vendedor),
      vendedor: String(r.vendedor ?? "—"),
      venta_mes: num(r.venta_mes),
      venta_anio: num(r.venta_anio),
      pct_mes: num(r.pct_mes),
      pct_anio: num(r.pct_anio),
    };
  });
}

function parseEmpresas(raw: unknown): EmpresaRow[] {
  return asArray(raw).map((row) => {
    const r = asObj(row);
    return {
      empresa: String(r.empresa ?? ""),
      nombre: String(r.nombre ?? ""),
      venta_dia: num(r.venta_dia),
      venta_mes: num(r.venta_mes),
      venta_anio: num(r.venta_anio),
      pct_dia: num(r.pct_dia),
      pct_mes: num(r.pct_mes),
      pct_anio: num(r.pct_anio),
    };
  });
}

function parseDimensiones(raw: unknown): ComercialDimensiones {
  const o = asObj(raw);
  return {
    vendedores: asArray(o.vendedores).map((row) => {
      const r = asObj(row);
      return {
        cod_vendedor: String(r.cod_vendedor ?? ""),
        vendedor: String(r.vendedor ?? ""),
      };
    }),
    familias: asArray(o.familias).map((f) => String(f)),
  };
}

export async function fetchComercialDashboard(
  filters: ComercialDashboardFilters,
): Promise<{
  kpis: ComercialKpis | null;
  matriz: ComercialMatriz | null;
  ranking: RankingRow[];
  empresas: EmpresaRow[];
  dimensiones: ComercialDimensiones;
  error: string | null;
}> {
  const supabase = await createCommercialServerClient();
  const empresa = filters.empresa;
  const moneda = filters.moneda;
  const fecha = filters.fecha;
  const vendedor = filters.vendedor || undefined;
  const familia = filters.familia || undefined;
  const periodo = filters.periodoRanking ?? "mes";

  const [kpisRes, matrizRes, rankingRes, empRes, dimRes] = await Promise.all([
    supabase.rpc("dashboard_kpis", {
      p_empresa: empresa,
      p_moneda: moneda,
      p_fecha: fecha,
      p_vendedor: vendedor,
      p_familia: familia,
    }),
    supabase.rpc("dashboard_matriz", {
      p_empresa: empresa,
      p_moneda: moneda,
      p_vendedor: vendedor,
      p_familia: familia,
    }),
    supabase.rpc("dashboard_ranking", {
      p_empresa: empresa,
      p_periodo: periodo,
      p_fecha: fecha,
      p_moneda: moneda,
      p_familia: familia,
    }),
    supabase.rpc("dashboard_por_empresa", {
      p_fecha: fecha,
      p_moneda: moneda,
      p_vendedor: vendedor,
      p_familia: familia,
    }),
    supabase.rpc("dashboard_dimensiones", { p_empresa: empresa }),
  ]);

  const err =
    kpisRes.error?.message ||
    matrizRes.error?.message ||
    rankingRes.error?.message ||
    empRes.error?.message ||
    dimRes.error?.message ||
    null;

  return {
    kpis: kpisRes.data ? parseKpis(kpisRes.data) : null,
    matriz: matrizRes.data ? parseMatriz(matrizRes.data) : null,
    ranking: rankingRes.data ? parseRanking(rankingRes.data) : [],
    empresas: empRes.data ? parseEmpresas(empRes.data) : [],
    dimensiones: dimRes.data
      ? parseDimensiones(dimRes.data)
      : { vendedores: [], familias: [] },
    error: err,
  };
}
