/** Tipos compartidos del OCR en cascada (Rendición). */

export type OcrMetodo = "qr_afip" | "tesseract" | "llm" | "none";

export type FieldSource = "qr_afip" | "tesseract" | "llm" | "none";

export type OcrIvaLine = {
  cod_alicuota: string | null;
  importe: number | null;
};

export type OcrFieldKey =
  | "total"
  | "fecha_emision"
  | "tipo_comprobante"
  | "nro_comprobante"
  | "cuit"
  | "moneda"
  | "cai_cae";

export type OcrSources = Partial<Record<OcrFieldKey, FieldSource>>;

export type OcrCascadeResult = {
  metodo: OcrMetodo;
  total: number | null;
  fecha_emision: string | null;
  tipo_comprobante: string | null;
  nro_comprobante: string | null;
  cuit: string | null;
  moneda: string | null;
  cai_cae: string | null;
  iva: OcrIvaLine[];
  confidence: "high" | "medium" | "low" | "none";
  sources: OcrSources;
  qr_afip: string | null;
  notes?: string;
  /** Texto crudo Tesseract (si corrió). */
  tesseract_text?: string | null;
  /** Respuesta cruda LLM (si corrió). */
  llm_raw?: string | null;
  /** Fases intentadas en orden. */
  phases: OcrMetodo[];
  ocr_available: boolean;
};

export function emptyCascade(notes?: string): OcrCascadeResult {
  return {
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
    notes,
    tesseract_text: null,
    llm_raw: null,
    phases: [],
    ocr_available: true,
  };
}

/** Payload típico AFIP FE QR (ver=1). */
export type AfipQrPayload = {
  ver?: number;
  fecha?: string;
  cuit?: number | string;
  ptoVta?: number;
  tipoCmp?: number;
  nroCmp?: number;
  importe?: number;
  moneda?: string;
  ctz?: number;
  tipoCodAut?: string;
  codAut?: number | string;
};
