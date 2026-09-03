"use server";

import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import { getCommercialSession } from "@/lib/commercial/session";
import { createCommercialServerClient } from "@/lib/supabase/commercial/server";

export type SaveRendicionInput = {
  imagePath: string;
  total: number | null;
  fechaEmision: string | null;
  tipoComprobante: string | null;
  nroComprobante: string | null;
  cuitEmisor: string | null;
  conceptoId: string;
  observaciones: string | null;
  iva?: Array<{ cod_alicuota: string | null; importe: number | null }> | null;
  ocrRaw?: Record<string, unknown> | null;
};

export async function saveRendicionAction(
  input: SaveRendicionInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const session = await getCommercialSession();
    requireStaffSession(session);
    if (!input.conceptoId) {
      return { ok: false, error: "Elegí un concepto / motivo" };
    }
    if (!input.imagePath) {
      return { ok: false, error: "Falta la imagen del comprobante" };
    }

    const supabase = await createCommercialServerClient();
    const payload = {
      image_path: input.imagePath,
      tipo: "gasto",
      total: input.total,
      fecha_emision: input.fechaEmision,
      tipo_comprobante: input.tipoComprobante,
      nro_comprobante: input.nroComprobante,
      cuit_emisor: input.cuitEmisor,
      concepto_id: input.conceptoId,
      observaciones: input.observaciones,
      iva: (input.iva ?? []).map((row) => ({
        cod_alicuota: row.cod_alicuota,
        importe: row.importe,
      })),
      ocr_raw: input.ocrRaw ?? null,
      estado: "rendido",
    };

    const { data, error } = await supabase.rpc("rendicion_save", {
      p: payload as never,
    });

    if (error) return { ok: false, error: error.message };
    revalidatePath("/gestion/rendicion");
    revalidatePath("/gestion/facturas");
    return { ok: true, id: String(data) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar",
    };
  }
}
