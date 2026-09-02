import "server-only";

import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import { getCommercialSession } from "@/lib/commercial/session";

export type VendedorHomeKpis = {
  fecha: string;
  cod_vendedor: string | null;
  ventas_mes_ars: number;
  ventas_dia_empresa_ars: number;
  cobranzas_pendiente: boolean;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** KPIs Home vendedor: mes del rep + día empresa Sure Rain (RPC). */
export async function getVendedorHomeKpis(): Promise<VendedorHomeKpis> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();

  const { data, error } = await supabase.rpc("vendedor_home_kpis");
  if (error) throw new Error(error.message);

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    fecha: String(row.fecha ?? new Date().toISOString().slice(0, 10)),
    cod_vendedor: row.cod_vendedor == null ? null : String(row.cod_vendedor),
    ventas_mes_ars: num(row.ventas_mes_ars),
    ventas_dia_empresa_ars: num(row.ventas_dia_empresa_ars),
    cobranzas_pendiente: row.cobranzas_pendiente !== false,
  };
}

export function formatArs(n: number): string {
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

export function formatFechaLarga(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
