import type { OcrCascadeResult, OcrIvaLine, OcrSources } from "./types";

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

export async function runLlmVision(input: {
  buffer: Buffer;
  mime: string;
}): Promise<{
  fields: Partial<OcrCascadeResult> & { sources: OcrSources };
  rawText: string;
} | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const b64 = input.buffer.toString("base64");
  const mime = input.mime.startsWith("image/") ? input.mime : "image/jpeg";

  const prompt = `Sos un extractor de facturas/comprobantes argentinos. Devolvé SOLO un JSON con:
{"total": number|null, "fecha_emision": "YYYY-MM-DD"|null, "tipo_comprobante": string|null, "nro_comprobante": string|null, "cuit": string|null, "moneda": string|null, "cai_cae": string|null, "iva": [{"cod_alicuota": string|null, "importe": number|null}], "confidence": "high"|"medium"|"low", "notes": string}
No inventes datos. Si no estás seguro, usá null.`;

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
                media_type: mime,
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
    return null;
  }

  const payload = (await anthropicRes.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = (payload.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
  const obj = parseJsonObject(text);
  if (!obj) {
    return { fields: { sources: {} }, rawText: text };
  }

  const sources: OcrSources = {};
  const total = asNum(obj.total) ?? asNum(obj.monto);
  if (total != null) sources.total = "llm";

  const fechaRaw = obj.fecha_emision ?? obj.fecha;
  const fecha_emision =
    typeof fechaRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)
      ? fechaRaw
      : null;
  if (fecha_emision) sources.fecha_emision = "llm";

  const cuitRaw = obj.cuit == null ? null : String(obj.cuit).replace(/\D/g, "");
  const cuit = cuitRaw && cuitRaw.length >= 10 ? cuitRaw : null;
  if (cuit) sources.cuit = "llm";

  const tipo_comprobante =
    obj.tipo_comprobante == null || obj.tipo_comprobante === ""
      ? null
      : String(obj.tipo_comprobante);
  if (tipo_comprobante) sources.tipo_comprobante = "llm";

  const nro_comprobante =
    obj.nro_comprobante == null || obj.nro_comprobante === ""
      ? null
      : String(obj.nro_comprobante);
  if (nro_comprobante) sources.nro_comprobante = "llm";

  const moneda =
    obj.moneda == null || obj.moneda === "" ? null : String(obj.moneda);
  if (moneda) sources.moneda = "llm";

  const cai_cae =
    obj.cai_cae == null || obj.cai_cae === "" ? null : String(obj.cai_cae);
  if (cai_cae) sources.cai_cae = "llm";

  const iva: OcrIvaLine[] = [];
  if (Array.isArray(obj.iva)) {
    for (const item of obj.iva) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      iva.push({
        cod_alicuota:
          row.cod_alicuota == null ? null : String(row.cod_alicuota),
        importe: asNum(row.importe),
      });
    }
  }

  const conf = obj.confidence;
  const confidence =
    conf === "high" || conf === "medium" || conf === "low" ? conf : "medium";

  return {
    rawText: text,
    fields: {
      total,
      fecha_emision,
      tipo_comprobante,
      nro_comprobante,
      cuit,
      moneda,
      cai_cae,
      iva,
      confidence,
      sources,
      notes: typeof obj.notes === "string" ? obj.notes : undefined,
    },
  };
}
