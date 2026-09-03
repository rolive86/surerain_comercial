import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import { runOcrCascade, toOcrRaw } from "@/lib/commercial/ocr/cascade";
import { getCommercialSession } from "@/lib/commercial/session";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await getCommercialSession();
  try {
    requireStaffSession(session);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta archivo" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Archivo demasiado grande" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";

  try {
    const result = await runOcrCascade({ buffer, mime });
    return NextResponse.json({
      ...result,
      /** Alias legacy para el cliente. */
      ocr_raw: toOcrRaw(result),
    });
  } catch (e) {
    return NextResponse.json(
      {
        metodo: "none",
        total: null,
        fecha_emision: null,
        tipo_comprobante: null,
        nro_comprobante: null,
        cuit: null,
        moneda: null,
        cai_cae: null,
        iva: [],
        confidence: "none",
        sources: {},
        qr_afip: null,
        phases: [],
        ocr_available: false,
        notes:
          e instanceof Error
            ? e.message
            : "OCR falló — completá a mano",
        ocr_raw: { metodo: "none", error: true },
      },
      { status: 200 },
    );
  }
}
