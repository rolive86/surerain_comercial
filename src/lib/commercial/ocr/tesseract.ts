import type { OcrCascadeResult, OcrSources } from "./types";

function asMoney(raw: string): number | null {
  const ar = raw.replace(/\s/g, "").replace(/\$/g, "");
  let n: number;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(ar)) {
    n = Number(ar.replace(/\./g, "").replace(",", "."));
  } else if (/^\d+,\d{1,2}$/.test(ar)) {
    n = Number(ar.replace(",", "."));
  } else if (/^\d+(\.\d{1,2})?$/.test(ar)) {
    n = Number(ar);
  } else {
    n = Number(ar.replace(/\./g, "").replace(",", "."));
  }
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeFechaParts(
  d: string,
  m: string,
  y: string,
): string | null {
  let year = Number(y);
  if (y.length === 2) year += year >= 70 ? 1900 : 2000;
  const day = Number(d);
  const month = Number(m);
  if (
    !Number.isFinite(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Extrae campos con heurísticas/regex sobre texto OCR. */
export function extractFromTesseractText(text: string): Pick<
  OcrCascadeResult,
  | "total"
  | "fecha_emision"
  | "tipo_comprobante"
  | "nro_comprobante"
  | "cuit"
  | "confidence"
  | "sources"
> {
  const sources: OcrSources = {};
  const upper = text.toUpperCase();

  // CUIT XX-XXXXXXXX-X o 11 dígitos
  let cuit: string | null = null;
  const cuitDash = text.match(/\b(\d{2})[-\s]?(\d{8})[-\s]?(\d)\b/);
  if (cuitDash) {
    cuit = `${cuitDash[1]}${cuitDash[2]}${cuitDash[3]}`;
    sources.cuit = "tesseract";
  } else {
    const cuitPlain = text.match(/\b(20|23|24|27|30|33|34)\d{9}\b/);
    if (cuitPlain) {
      cuit = cuitPlain[0];
      sources.cuit = "tesseract";
    }
  }

  // Fecha
  let fecha_emision: string | null = null;
  const fechaPatterns = [
    /(?:FECHA|EMISION|EMISI[OÓ]N|DATE)[^\d]{0,12}(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i,
    /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/,
    /\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/,
  ];
  for (const re of fechaPatterns) {
    const m = text.match(re);
    if (!m) continue;
    if (re === fechaPatterns[2]) {
      fecha_emision = normalizeFechaParts(m[3], m[2], m[1]);
    } else {
      fecha_emision = normalizeFechaParts(m[1], m[2], m[3]);
    }
    if (fecha_emision) {
      sources.fecha_emision = "tesseract";
      break;
    }
  }

  // Total: línea con TOTAL, o importe mayor razonable
  let total: number | null = null;
  const totalLine = text.match(
    /(?:TOTAL|TOTAL\s*A\s*PAGAR|IMPORTE\s*TOTAL|TOTAL\s*FACTURA)[^\d$]{0,20}\$?\s*([\d.,]+)/i,
  );
  if (totalLine) {
    total = asMoney(totalLine[1]);
    if (total != null) sources.total = "tesseract";
  }
  if (total == null) {
    const amounts: number[] = [];
    for (const m of text.matchAll(/\$?\s*(\d{1,3}(?:[.,]\d{3})+[.,]\d{2}|\d+[.,]\d{2})\b/g)) {
      const n = asMoney(m[1]);
      if (n != null && n < 50_000_000) amounts.push(n);
    }
    if (amounts.length) {
      total = Math.max(...amounts);
      sources.total = "tesseract";
    }
  }

  let tipo_comprobante: string | null = null;
  if (/\bFACTURA\s*A\b/.test(upper)) tipo_comprobante = "Factura A";
  else if (/\bFACTURA\s*B\b/.test(upper)) tipo_comprobante = "Factura B";
  else if (/\bFACTURA\s*C\b/.test(upper)) tipo_comprobante = "Factura C";
  else if (/\bTICKET\b/.test(upper)) tipo_comprobante = "Ticket";
  else if (/\bFACTURA\b/.test(upper)) tipo_comprobante = "Factura";
  if (tipo_comprobante) sources.tipo_comprobante = "tesseract";

  let nro_comprobante: string | null = null;
  const nro = text.match(
    /\b(?:N[°ºo.]?\s*|COMP\.?\s*|NRO\.?\s*)(\d{4,5}[-\s]?\d{6,8}|\d{8,13})\b/i,
  );
  if (nro) {
    nro_comprobante = nro[1].replace(/\s/g, "");
    sources.nro_comprobante = "tesseract";
  }

  const confidence =
    total != null && fecha_emision
      ? "medium"
      : total != null || fecha_emision
        ? "low"
        : "none";

  return {
    total,
    fecha_emision,
    tipo_comprobante,
    nro_comprobante,
    cuit,
    confidence,
    sources,
  };
}

export async function runTesseract(
  buffer: Buffer,
  _mime: string,
): Promise<{ text: string; fields: ReturnType<typeof extractFromTesseractText> }> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa+eng", 1, {
    // Evita logs ruidosos en serverless
    logger: () => undefined,
    cachePath: ".tesscache",
  });
  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);
    const fields = extractFromTesseractText(text ?? "");
    return { text: text ?? "", fields };
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

/** ¿Tesseract resolvió lo mínimo (total + fecha)? */
export function tesseractResolvedCore(fields: {
  total: number | null;
  fecha_emision: string | null;
}): boolean {
  return fields.total != null && Boolean(fields.fecha_emision);
}
