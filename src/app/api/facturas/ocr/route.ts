import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import { getCommercialSession } from "@/lib/commercial/session";

export const runtime = "nodejs";

type OcrFields = {
  monto: number | null;
  fecha: string | null;
  cuit: string | null;
  qr_afip: string | null;
  confidence: "high" | "medium" | "low" | "none";
  notes?: string;
};

function emptyFields(notes?: string): OcrFields {
  return {
    monto: null,
    fecha: null,
    cuit: null,
    qr_afip: null,
    confidence: "none",
    notes,
  };
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeFields(obj: Record<string, unknown> | null): OcrFields {
  if (!obj) return emptyFields("OCR sin JSON válido");
  const montoRaw = obj.monto;
  const monto =
    typeof montoRaw === "number"
      ? montoRaw
      : typeof montoRaw === "string"
        ? Number(String(montoRaw).replace(/\./g, "").replace(",", "."))
        : null;
  const fecha =
    typeof obj.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.fecha)
      ? obj.fecha
      : null;
  const cuitRaw = obj.cuit == null ? null : String(obj.cuit).replace(/\D/g, "");
  const cuit = cuitRaw && cuitRaw.length >= 10 ? cuitRaw : null;
  const qr =
    obj.qr_afip == null || obj.qr_afip === ""
      ? null
      : String(obj.qr_afip);
  const conf = obj.confidence;
  const confidence =
    conf === "high" || conf === "medium" || conf === "low" || conf === "none"
      ? conf
      : "medium";
  return {
    monto: Number.isFinite(monto as number) ? (monto as number) : null,
    fecha,
    cuit,
    qr_afip: qr,
    confidence,
    notes: typeof obj.notes === "string" ? obj.notes : undefined,
  };
}

/** Prefer AFIP QR payload when present (más confiable que OCR visual). */
function fieldsFromAfipQr(qr: string): Partial<OcrFields> {
  try {
    // AFIP QR suele ser URL con query ver=1&fecha=...&cuit=...&importe=...
    const url = new URL(qr);
    const cuit = url.searchParams.get("cuit")?.replace(/\D/g, "") ?? null;
    const importe = url.searchParams.get("importe");
    const fechaRaw = url.searchParams.get("fecha");
    let fecha: string | null = null;
    if (fechaRaw) {
      // dd/mm/yyyy or yyyy-mm-dd
      if (/^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)) fecha = fechaRaw;
      else {
        const m = fechaRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) {
          fecha = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        }
      }
    }
    const monto = importe != null ? Number(importe) : null;
    return {
      cuit: cuit && cuit.length >= 10 ? cuit : null,
      fecha,
      monto: Number.isFinite(monto as number) ? (monto as number) : null,
      qr_afip: qr,
      confidence: "high",
    };
  } catch {
    return { qr_afip: qr };
  }
}

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
    return NextResponse.json({ error: "Archivo demasiado grande" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";
  const b64 = bytes.toString("base64");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ...emptyFields(
        "ANTHROPIC_API_KEY no configurada — completá monto/fecha/CUIT a mano",
      ),
      ocr_available: false,
    });
  }

  const prompt = `Sos un extractor de facturas argentinas. Devolvé SOLO un JSON con:
{"monto": number|null, "fecha": "YYYY-MM-DD"|null, "cuit": string|null, "qr_afip": string|null, "confidence": "high"|"medium"|"low", "notes": string}
- monto: total de la factura en ARS (número, sin símbolo).
- fecha: fecha del comprobante.
- cuit: CUIT del emisor (solo dígitos) si aparece.
- qr_afip: si hay QR de AFIP visible, decodificá/transcribí la URL o payload completo (es más confiable).
No inventes datos. Si no estás seguro, usá null y confidence low.`;

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mime.startsWith("image/") ? mime : "image/jpeg",
                data: b64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "");
    return NextResponse.json({
      ...emptyFields(`OCR falló (${anthropicRes.status}). Completá a mano.`),
      ocr_available: false,
      provider_error: errText.slice(0, 200),
    });
  }

  const payload = (await anthropicRes.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = (payload.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
  let fields = normalizeFields(parseJsonObject(text));

  if (fields.qr_afip) {
    const fromQr = fieldsFromAfipQr(fields.qr_afip);
    fields = {
      ...fields,
      ...fromQr,
      monto: fromQr.monto ?? fields.monto,
      fecha: fromQr.fecha ?? fields.fecha,
      cuit: fromQr.cuit ?? fields.cuit,
      confidence: fromQr.confidence ?? fields.confidence,
    };
  }

  return NextResponse.json({ ...fields, ocr_available: true, raw_text: text });
}
