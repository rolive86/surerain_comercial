import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { getCommercialSession } from "@/lib/commercial/session";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import { getTangoFamilias } from "@/lib/commercial/products-tango";

export type RecontactRow = {
  customer_id: string;
  cliente: string;
  localidad: string | null;
  provincia: string | null;
  telefono: string | null;
  cant_anio_base: number;
  total_anio_base: number;
  ultima_compra: string | null;
  cant_anio_actual: number;
};

export type ComparativoRow = {
  cod_articulo: string;
  descripcion: string | null;
  familia: string | null;
  cant_anio_base: number;
  total_anio_base: number;
  cant_anio_actual: number;
  total_anio_actual: number;
  estado: string;
};

export type RankingZonaRow = {
  zona: string;
  familia: string;
  cant_anio_base: number;
  total_anio_base: number;
  cant_anio_actual: number;
  total_anio_actual: number;
};

export type IntelFilters = {
  familia?: string;
  codArticulo?: string;
  mesDesde: number;
  mesHasta: number;
  anioBase: number;
  localidad?: string;
  provincia?: string;
};

const MONTH_LABELS = [
  "",
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
];

export function monthLabel(m: number): string {
  return MONTH_LABELS[m] ?? String(m);
}

export function periodLabel(desde: number, hasta: number): string {
  if (desde === hasta) return monthLabel(desde);
  return `${monthLabel(desde)}–${monthLabel(hasta)}`;
}

export function normalizeWaPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("54") && digits.length >= 12) return digits;
  if (digits.startsWith("549") && digits.length >= 12) return digits;
  if (digits.length === 10) return `549${digits}`;
  if (digits.length === 11 && digits.startsWith("15")) {
    return `549${digits.slice(2)}`;
  }
  if (digits.length >= 8 && digits.length <= 11) return `54${digits}`;
  return digits.length >= 10 ? digits : null;
}

export function waMeUrl(phone: string | null | undefined, text?: string): string | null {
  const n = normalizeWaPhone(phone);
  if (!n) return null;
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${n}${q}`;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function listIntelFamilias(): Promise<Array<{ slug: string; name: string }>> {
  return getTangoFamilias();
}

export async function listIntelZones(): Promise<{
  localidades: string[];
  provincias: string[];
}> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select("city, province")
    .eq("active", true)
    .limit(5000);
  if (error) throw new Error(error.message);
  const localidades = new Set<string>();
  const provincias = new Set<string>();
  for (const row of data ?? []) {
    const city = row.city?.trim();
    const prov = row.province?.trim();
    if (city) localidades.add(city);
    if (prov) provincias.add(prov);
  }
  return {
    localidades: [...localidades].sort((a, b) => a.localeCompare(b, "es")),
    provincias: [...provincias].sort((a, b) => a.localeCompare(b, "es")),
  };
}

export async function listCarteraCustomers(): Promise<
  Array<{ id: string; label: string }>
> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, legal_name, trade_name")
    .eq("active", true)
    .order("legal_name")
    .limit(3000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    id: c.id,
    label: c.trade_name || c.legal_name,
  }));
}

export async function getClientesARecontactar(
  filters: IntelFilters,
): Promise<RecontactRow[]> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();

  const { data, error } = await supabase.rpc("clientes_a_recontactar", {
    p_familia: filters.familia?.trim() || null,
    p_cod_articulo: filters.codArticulo?.trim() || null,
    p_mes_desde: filters.mesDesde,
    p_mes_hasta: filters.mesHasta,
    p_anio_base: filters.anioBase,
    p_localidad: filters.localidad?.trim() || null,
    p_provincia: filters.provincia?.trim() || null,
  });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    customer_id: String(row.customer_id),
    cliente: String(row.cliente ?? "—"),
    localidad: (row.localidad as string | null) ?? null,
    provincia: (row.provincia as string | null) ?? null,
    telefono: (row.telefono as string | null) ?? null,
    cant_anio_base: num(row.cant_anio_base),
    total_anio_base: num(row.total_anio_base),
    ultima_compra: row.ultima_compra ? String(row.ultima_compra) : null,
    cant_anio_actual: num(row.cant_anio_actual),
  }));
}

export async function getClienteComparativo(
  customerId: string,
  mesDesde: number,
  mesHasta: number,
  anioBase: number,
  diaHasta?: number | null,
): Promise<ComparativoRow[]> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();

  const { data, error } = await supabase.rpc("cliente_comparativo_periodo", {
    p_customer_id: customerId,
    p_mes_desde: mesDesde,
    p_mes_hasta: mesHasta,
    p_anio_base: anioBase,
    ...(diaHasta != null ? { p_dia_hasta: diaHasta } : {}),
  });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    cod_articulo: String(row.cod_articulo),
    descripcion: (row.descripcion as string | null) ?? null,
    familia: (row.familia as string | null) ?? null,
    cant_anio_base: num(row.cant_anio_base),
    total_anio_base: num(row.total_anio_base),
    cant_anio_actual: num(row.cant_anio_actual),
    total_anio_actual: num(row.total_anio_actual),
    estado: String(row.estado ?? "igual"),
  }));
}

export async function getRankingZonaFamilia(
  mesDesde: number,
  mesHasta: number,
  anioBase: number,
  agruparPor: "localidad" | "provincia",
): Promise<RankingZonaRow[]> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();

  const { data, error } = await supabase.rpc("ranking_zona_familia", {
    p_mes_desde: mesDesde,
    p_mes_hasta: mesHasta,
    p_anio_base: anioBase,
    p_agrupar_por: agruparPor,
  });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    zona: String(row.zona ?? "—"),
    familia: String(row.familia ?? "—"),
    cant_anio_base: num(row.cant_anio_base),
    total_anio_base: num(row.total_anio_base),
    cant_anio_actual: num(row.cant_anio_actual),
    total_anio_actual: num(row.total_anio_actual),
  }));
}
