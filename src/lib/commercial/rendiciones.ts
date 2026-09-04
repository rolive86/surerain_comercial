import "server-only";

import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import { getCommercialSession } from "@/lib/commercial/session";

export type ConceptoRendicion = {
  id: string;
  nombre: string;
  cod_concepto: string | null;
  centro_costo_id: string | null;
  centro_nombre: string | null;
  cod_sector: string | null;
};

export type ComprobanteRow = {
  id: string;
  tipo: string | null;
  total: number | null;
  fecha_emision: string | null;
  tipo_comprobante: string | null;
  nro_comprobante: string | null;
  cuit_emisor: string | null;
  estado: string;
  observaciones: string | null;
  image_path: string | null;
  concepto_id: string | null;
  concepto_nombre: string | null;
  created_at: string;
};

function asArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function listConceptosRendicion(): Promise<ConceptoRendicion[]> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase.rpc("rendicion_list_conceptos");
  if (error) throw new Error(error.message);
  return asArray(data).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      nombre: String(r.nombre ?? ""),
      cod_concepto: r.cod_concepto == null ? null : String(r.cod_concepto),
      centro_costo_id:
        r.centro_costo_id == null ? null : String(r.centro_costo_id),
      centro_nombre: r.centro_nombre == null ? null : String(r.centro_nombre),
      cod_sector: r.cod_sector == null ? null : String(r.cod_sector),
    };
  });
}

export async function listMisComprobantes(): Promise<ComprobanteRow[]> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase.rpc("rendicion_list_mis", {
    p_limit: 100,
  });
  if (error) throw new Error(error.message);
  return asArray(data).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      tipo: r.tipo == null ? null : String(r.tipo),
      total: r.total == null ? null : Number(r.total),
      fecha_emision:
        r.fecha_emision == null ? null : String(r.fecha_emision).slice(0, 10),
      tipo_comprobante:
        r.tipo_comprobante == null ? null : String(r.tipo_comprobante),
      nro_comprobante:
        r.nro_comprobante == null ? null : String(r.nro_comprobante),
      cuit_emisor: r.cuit_emisor == null ? null : String(r.cuit_emisor),
      estado: String(r.estado ?? "rendido"),
      observaciones:
        r.observaciones == null ? null : String(r.observaciones),
      image_path: r.image_path == null ? null : String(r.image_path),
      concepto_id: r.concepto_id == null ? null : String(r.concepto_id),
      concepto_nombre:
        r.concepto_nombre == null ? null : String(r.concepto_nombre),
      created_at: String(r.created_at),
    };
  });
}
