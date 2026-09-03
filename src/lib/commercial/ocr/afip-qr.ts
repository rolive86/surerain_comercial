import type { AfipQrPayload, OcrCascadeResult, OcrSources } from "./types";

/** Códigos AFIP tipoCmp → etiqueta corta. */
const TIPO_CMP: Record<number, string> = {
  1: "Factura A",
  2: "Nota de Débito A",
  3: "Nota de Crédito A",
  6: "Factura B",
  7: "Nota de Débito B",
  8: "Nota de Crédito B",
  11: "Factura C",
  12: "Nota de Débito C",
  13: "Nota de Crédito C",
  51: "Factura M",
  81: "Ticket Factura A",
  82: "Ticket Factura B",
  83: "Ticket",
};

function padPtoVta(n: number): string {
  return String(n).padStart(5, "0");
}

function padNro(n: number): string {
  return String(n).padStart(8, "0");
}

function normalizeFecha(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

function decodeBase64Json(b64: string): AfipQrPayload | null {
  try {
    const normalized = b64.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(normalized, "base64").toString("utf8");
    const obj = JSON.parse(json) as AfipQrPayload;
    if (obj && typeof obj === "object") return obj;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Parsea URL AFIP `.../fe/qr/?p=<base64>` o payload JSON directo.
 * También soporta query string legacy (cuit/importe/fecha).
 */
export function parseAfipQrUrl(raw: string): {
  payload: AfipQrPayload | null;
  url: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Payload JSON directo
  if (trimmed.startsWith("{")) {
    try {
      return { payload: JSON.parse(trimmed) as AfipQrPayload, url: trimmed };
    } catch {
      return null;
    }
  }

  try {
    const url = new URL(trimmed);
    const p = url.searchParams.get("p");
    if (p) {
      return { payload: decodeBase64Json(p), url: trimmed };
    }
    // Legacy query params
    if (
      url.hostname.includes("afip") ||
      url.searchParams.has("cuit") ||
      url.searchParams.has("importe")
    ) {
      const fecha = url.searchParams.get("fecha") ?? undefined;
      const cuit = url.searchParams.get("cuit") ?? undefined;
      const importe = url.searchParams.get("importe");
      const tipo = url.searchParams.get("tipo") ?? url.searchParams.get("tipoCmp");
      const nro =
        url.searchParams.get("nro") ??
        url.searchParams.get("nroCmp") ??
        undefined;
      const pto = url.searchParams.get("ptovta") ?? url.searchParams.get("ptoVta");
      return {
        url: trimmed,
        payload: {
          fecha,
          cuit: cuit ?? undefined,
          importe: importe != null ? Number(importe) : undefined,
          tipoCmp: tipo != null ? Number(tipo) : undefined,
          nroCmp: nro != null ? Number(nro) : undefined,
          ptoVta: pto != null ? Number(pto) : undefined,
          moneda: url.searchParams.get("moneda") ?? undefined,
          codAut: url.searchParams.get("codAut") ?? url.searchParams.get("cae") ?? undefined,
        },
      };
    }
  } catch {
    // Maybe raw base64
    const payload = decodeBase64Json(trimmed);
    if (payload) return { payload, url: trimmed };
  }

  return null;
}

export function fieldsFromAfipPayload(
  payload: AfipQrPayload,
  qrUrl: string,
): Pick<
  OcrCascadeResult,
  | "total"
  | "fecha_emision"
  | "tipo_comprobante"
  | "nro_comprobante"
  | "cuit"
  | "moneda"
  | "cai_cae"
  | "confidence"
  | "qr_afip"
  | "sources"
> {
  const sources: OcrSources = {};
  const fecha_emision = normalizeFecha(
    typeof payload.fecha === "string" ? payload.fecha : undefined,
  );
  if (fecha_emision) sources.fecha_emision = "qr_afip";

  const cuitDigits = String(payload.cuit ?? "").replace(/\D/g, "");
  const cuit = cuitDigits.length >= 10 ? cuitDigits : null;
  if (cuit) sources.cuit = "qr_afip";

  const total =
    typeof payload.importe === "number" && Number.isFinite(payload.importe)
      ? payload.importe
      : null;
  if (total != null) sources.total = "qr_afip";

  const tipoCmp =
    typeof payload.tipoCmp === "number" ? payload.tipoCmp : null;
  const tipo_comprobante =
    tipoCmp != null ? (TIPO_CMP[tipoCmp] ?? `Tipo ${tipoCmp}`) : null;
  if (tipo_comprobante) sources.tipo_comprobante = "qr_afip";

  let nro_comprobante: string | null = null;
  if (
    typeof payload.ptoVta === "number" &&
    typeof payload.nroCmp === "number"
  ) {
    nro_comprobante = `${padPtoVta(payload.ptoVta)}-${padNro(payload.nroCmp)}`;
    sources.nro_comprobante = "qr_afip";
  } else if (typeof payload.nroCmp === "number") {
    nro_comprobante = String(payload.nroCmp);
    sources.nro_comprobante = "qr_afip";
  }

  const moneda =
    payload.moneda == null || payload.moneda === ""
      ? null
      : String(payload.moneda);
  if (moneda) sources.moneda = "qr_afip";

  const cai_cae =
    payload.codAut == null || payload.codAut === ""
      ? null
      : String(payload.codAut);
  if (cai_cae) sources.cai_cae = "qr_afip";

  return {
    total,
    fecha_emision,
    tipo_comprobante,
    nro_comprobante,
    cuit,
    moneda,
    cai_cae,
    confidence: "high",
    qr_afip: qrUrl,
    sources,
  };
}

/** True si el QR AFIP aportó al menos total o fecha (datos útiles). */
export function afipPayloadUseful(payload: AfipQrPayload): boolean {
  const fecha = normalizeFecha(
    typeof payload.fecha === "string" ? payload.fecha : undefined,
  );
  const total =
    typeof payload.importe === "number" && Number.isFinite(payload.importe);
  return Boolean(fecha || total);
}
