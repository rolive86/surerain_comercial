import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import { getCommercialSession } from "@/lib/commercial/session";

export const runtime = "nodejs";

type OcrFields = {
  total: number | null;
  fecha_emision: string | null;
  tipo_comprobante: string | null;
  nro_comprobante: string | null;
  cuit: string | null;
  iva: Array<{ cod_alicuota: string | null; importe: number | null }>;
  qr_afip: string | null;
  confidence: "high" | "medium" | "low" | "none";
  notes?: string;
};

function emptyFields(notes?: string): OcrFields {
  return {
    total: null,
    fecha_emision: null,
    tipo_comprobante: null,
    nro_comprobante: null,
    cuit: null,
    iva: [],
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

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(String(value).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeFields(obj: Record<string, unknown> | null): OcrFields {
  if (!obj) return emptyFields("OCR sin JSON válido");
  const total =
    asNum(obj.total) ??
    asNum(obj.monto) ??
    null;
  const fechaRaw = obj.fecha_emision ?? obj.fecha;
  const fecha_emision =
    typeof fechaRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)
      ? fechaRaw
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

  const ivaRaw = obj.iva;
  const iva: OcrFields["iva"] = [];
  if (Array.isArray(ivaRaw)) {
    for (const item of ivaRaw) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      iva.push({
        cod_alicuota:
          row.cod_alicuota == null ? null : String(row.cod_alicuota),
        importe: asNum(row.importe),
      });
    }
  }

  return {
    total,
    fecha_emision,
    tipo_comprobante:
      obj.tipo_comprobante == null || obj.tipo_comprobante === ""
        ? null
        : String(obj.tipo_comprobante),
    nro_comprobante:
      obj.nro_comprobante == null || obj.nro_comprobante === ""
        ? null
        : String(obj.nro_comprobante),
    cuit,
    iva,
    qr_afip: qr,
    confidence,
    notes: typeof obj.notes === "string" ? obj.notes : undefined,
  };
}

/** Prefer AFIP QR payload when present (más confiable que OCR visual). */
function fieldsFromAfipQr(qr: string): Partial<OcrFields> {
  try {
    const url = new URL(qr);
    const cuit = url.searchParams.get("cuit")?.replace(/\D/g, "") ?? null;
    const importe = url.searchParams.get("importe");
    const fechaRaw = url.searchParams.get("fecha");
    let fecha_emision: string | null = null;
    if (fechaRaw) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)) fecha_emision = fechaRaw;
      else {
        const m = fechaRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) {
          fecha_emision = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        }
      }
    }
    const total = importe != null ? Number(importe) : null;
    const tipo = url.searchParams.get("tipo") ?? url.searchParams.get("tipoCmp");
    const nro =
      url.searchParams.get("nro") ??
      url.searchParams.get("nroCmp") ??
      url.searchParams.get("ptovta");
    return {
      cuit: cuit && cuit.length >= 10 ? cuit : null,
      fecha_emision,
      total: Number.isFinite(total as number) ? (total as number) : null,
      tipo_comprobante: tipo,
      nro_comprobante: nro,
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
    return NextResponse.json(
      { error: "Archivo demasiado grande" },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";
  const b64 = bytes.toString("base64");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ...emptyFields(
        "ANTHROPIC_API_KEY no configurada — completá total/fecha/CUIT a mano",
      ),
      ocr_available: false,
    });
  }

  const prompt = `Sos un extractor de facturas/comprobantes argentinos. Devolvé SOLO un JSON con:
{"total": number|null, "fecha_emision": "YYYY-MM-DD"|null, "tipo_comprobante": string|null, "nro_comprobante": string|null, "cuit": string|null, "iva": [{"cod_alicuota": string|null, "importe": number|null}], "qr_afip": string|null, "confidence": "high"|"medium"|"low", "notes": string}
- total: total del comprobante en ARS.
- fecha_emision: fecha del comprobante.
- tipo_comprobante: ej. Factura A/B/C, ticket, etc. (corto).
- nro_comprobante: número completo si aparece.
- cuit: CUIT del emisor (solo dígitos).
- iva: líneas de alícuota si se distinguen (cod_alicuota ej. "21", "10.5"); si no, [].
- qr_afip: si hay QR AFIP, URL/payload completo.
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
      max_tokens: 1000,
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
      total: fromQr.total ?? fields.total,
      fecha_emision: fromQr.fecha_emision ?? fields.fecha_emision,
      cuit: fromQr.cuit ?? fields.cuit,
      tipo_comprobante: fromQr.tipo_comprobante ?? fields.tipo_comprobante,
      nro_comprobante: fromQr.nro_comprobante ?? fields.nro_comprobante,
      confidence: fromQr.confidence ?? fields.confidence,
      iva: fields.iva,
    };
  }

  return NextResponse.json({ ...fields, ocr_available: true, raw_text: text });
}
