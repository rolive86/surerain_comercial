"use server";

import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import { resolveCodVendedor } from "@/lib/commercial/facturas";
import { getCommercialSession } from "@/lib/commercial/session";
import { createCommercialServerClient } from "@/lib/supabase/commercial/server";

export type SaveFacturaInput = {
  imagePath: string;
  tipo: "gasto" | "venta";
  centroCostoId: string;
  motivoId: string;
  monto: number | null;
  fecha: string | null;
  cuit: string | null;
  ocrRaw?: Record<string, unknown> | null;
};

export async function saveFacturaAction(
  input: SaveFacturaInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const session = await getCommercialSession();
    requireStaffSession(session);
    const supabase = await createCommercialServerClient();
    const codVendedor = await resolveCodVendedor();

    const { data, error } = await supabase
      .from("facturas")
      .insert({
        uploaded_by: session!.user.id,
        cod_vendedor: codVendedor,
        tipo: input.tipo,
        centro_costo_id: input.centroCostoId || null,
        motivo_id: input.motivoId || null,
        image_path: input.imagePath,
        monto: input.monto,
        fecha: input.fecha,
        cuit: input.cuit,
        ocr_raw: (input.ocrRaw ?? null) as never,
        estado: "subida",
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    revalidatePath("/gestion/facturas");
    return { ok: true, id: String(data.id) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar",
    };
  }
}
