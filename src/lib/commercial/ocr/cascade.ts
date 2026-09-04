import {
  afipPayloadUseful,
  fieldsFromAfipPayload,
  parseAfipQrUrl,
} from "./afip-qr";
import { isRendicionLlmOcrEnabled } from "./config";
import { decodeQrFromImage } from "./decode-qr";
import { runLlmVision } from "./llm";
import {
  runTesseract,
  tesseractResolvedCore,
} from "./tesseract";
import { emptyCascade, type OcrCascadeResult, type OcrSources } from "./types";

function mergeSources(
  base: OcrSources,
  overlay: OcrSources,
  onlyFillEmpty = true,
): OcrSources {
  const out = { ...base };
  for (const [k, v] of Object.entries(overlay) as Array<
    [keyof OcrSources, OcrSources[keyof OcrSources]]
  >) {
    if (!v) continue;
    if (onlyFillEmpty && out[k]) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Cascada: QR AFIP → Tesseract → LLM (solo si flag ON y faltan total+fecha).
 */
export async function runOcrCascade(input: {
  buffer: Buffer;
  mime: string;
}): Promise<OcrCascadeResult> {
  const phases: OcrCascadeResult["phases"] = [];
  const result = emptyCascade();

  // ── FASE 1: QR AFIP ──────────────────────────────────────────────────────
  if (input.mime.startsWith("image/") || !input.mime) {
    try {
      const qrRaw = await decodeQrFromImage(input.buffer);
      if (qrRaw) {
        phases.push("qr_afip");
        const parsed = parseAfipQrUrl(qrRaw);
        if (parsed?.payload && afipPayloadUseful(parsed.payload)) {
          const fields = fieldsFromAfipPayload(parsed.payload, parsed.url);
          return {
            ...result,
            ...fields,
            metodo: "qr_afip",
            iva: [],
            phases,
            ocr_available: true,
            notes: "Datos exactos desde QR AFIP",
          };
        }
        result.qr_afip = qrRaw;
        result.notes = "QR detectado pero no es payload AFIP usable";
      }
    } catch (e) {
      result.notes =
        e instanceof Error
          ? `QR: ${e.message}`
          : "QR: error al decodificar";
    }
  }

  // ── FASE 2: Tesseract ────────────────────────────────────────────────────
  let tesseractText: string | null = null;
  try {
    phases.push("tesseract");
    // Soft cap so serverless work ends before client 40s / route 60s when possible.
    const tess = await Promise.race([
      runTesseract(input.buffer, input.mime),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Tesseract timeout")),
          35_000,
        );
      }),
    ]);
    const { text, fields } = tess;
    tesseractText = text;
    result.tesseract_text = text.slice(0, 8000);
    result.total = fields.total;
    result.fecha_emision = fields.fecha_emision;
    result.tipo_comprobante = fields.tipo_comprobante;
    result.nro_comprobante = fields.nro_comprobante;
    result.cuit = fields.cuit;
    result.confidence = fields.confidence;
    result.sources = { ...fields.sources };
    result.metodo = "tesseract";
    result.notes =
      fields.confidence === "none"
        ? "Tesseract no extrajo campos claros — completá a mano"
        : "Leído de la imagen (Tesseract)";

    if (tesseractResolvedCore(fields)) {
      result.phases = phases;
      result.ocr_available = true;
      return result;
    }
  } catch (e) {
    result.notes =
      e instanceof Error
        ? `Tesseract: ${e.message}`
        : "Tesseract falló";
  }

  // ── FASE 3: LLM (opcional) ───────────────────────────────────────────────
  if (isRendicionLlmOcrEnabled()) {
    phases.push("llm");
    try {
      const llm = await runLlmVision({
        buffer: input.buffer,
        mime: input.mime,
      });
      if (llm) {
        result.llm_raw = llm.rawText.slice(0, 4000);
        const f = llm.fields;
        if (result.total == null && f.total != null) result.total = f.total;
        if (!result.fecha_emision && f.fecha_emision) {
          result.fecha_emision = f.fecha_emision;
        }
        if (!result.tipo_comprobante && f.tipo_comprobante) {
          result.tipo_comprobante = f.tipo_comprobante;
        }
        if (!result.nro_comprobante && f.nro_comprobante) {
          result.nro_comprobante = f.nro_comprobante;
        }
        if (!result.cuit && f.cuit) result.cuit = f.cuit;
        if (!result.moneda && f.moneda) result.moneda = f.moneda;
        if (!result.cai_cae && f.cai_cae) result.cai_cae = f.cai_cae;
        if (f.iva?.length) result.iva = f.iva;
        result.sources = mergeSources(result.sources, f.sources ?? {}, true);
        result.metodo = "llm";
        result.confidence = f.confidence ?? "medium";
        result.notes = f.notes ?? "Completado con visión LLM";
      } else {
        result.notes =
          (result.notes ? `${result.notes}. ` : "") +
          "LLM no disponible (sin API key o error)";
      }
    } catch (e) {
      result.notes =
        (result.notes ? `${result.notes}. ` : "") +
        (e instanceof Error ? `LLM: ${e.message}` : "LLM falló");
    }
  } else if (!tesseractResolvedCore(result)) {
    result.notes =
      (result.notes ? `${result.notes}. ` : "") +
      "LLM apagado (RENDICION_OCR_LLM). Completá a mano si falta algo.";
  }

  result.phases = phases;
  result.tesseract_text = tesseractText?.slice(0, 8000) ?? result.tesseract_text;
  if (
    result.metodo === "tesseract" &&
    result.total == null &&
    !result.fecha_emision
  ) {
    result.metodo = "none";
    result.confidence = "none";
  }
  result.ocr_available = true;
  return result;
}

/** Objeto listo para persistir en comprobantes.ocr_raw */
export function toOcrRaw(result: OcrCascadeResult): Record<string, unknown> {
  return {
    metodo: result.metodo,
    confidence: result.confidence,
    sources: result.sources,
    phases: result.phases,
    total: result.total,
    fecha_emision: result.fecha_emision,
    tipo_comprobante: result.tipo_comprobante,
    nro_comprobante: result.nro_comprobante,
    cuit: result.cuit,
    moneda: result.moneda,
    cai_cae: result.cai_cae,
    iva: result.iva,
    qr_afip: result.qr_afip,
    tesseract_text: result.tesseract_text ?? null,
    llm_raw: result.llm_raw ?? null,
    notes: result.notes ?? null,
  };
}
