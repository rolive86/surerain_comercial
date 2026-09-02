import "server-only";

import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import { getCommercialSession } from "@/lib/commercial/session";

export type CentroCosto = { id: string; nombre: string };
export type MotivoFactura = { id: string; nombre: string };

export type FacturaRow = {
  id: string;
  tipo: string | null;
  monto: number | null;
  fecha: string | null;
  estado: string;
  created_at: string;
  image_path: string;
  cuit: string | null;
};

export async function listCentrosCosto(): Promise<CentroCosto[]> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("centros_costo")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as CentroCosto[];
}

export async function listMotivosFactura(): Promise<MotivoFactura[]> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("motivos_factura")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as MotivoFactura[];
}

export async function listMisFacturas(): Promise<FacturaRow[]> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("facturas")
    .select("id, tipo, monto, fecha, estado, created_at, image_path, cuit")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    tipo: r.tipo == null ? null : String(r.tipo),
    monto: r.monto == null ? null : Number(r.monto),
    fecha: r.fecha == null ? null : String(r.fecha),
    estado: String(r.estado ?? "subida"),
    created_at: String(r.created_at),
    image_path: String(r.image_path),
    cuit: r.cuit == null ? null : String(r.cuit),
  }));
}

export async function resolveCodVendedor(): Promise<string | null> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const repId = session!.claims.sales_rep_id;
  if (!repId) return null;
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("sales_reps")
    .select("tango_sales_rep_id")
    .eq("id", repId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.tango_sales_rep_id ?? null;
}
