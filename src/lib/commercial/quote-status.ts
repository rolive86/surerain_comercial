/** Etiquetas de cotización para el portal del cliente (sin exponer precios). */
export const CUSTOMER_QUOTE_STATUS_LABEL: Record<string, string> = {
  submitted: "Pendiente",
  quoted: "Cotizada",
  sent: "Enviada",
};

export function customerQuoteStatusLabel(code: string, fallback?: string): string {
  return CUSTOMER_QUOTE_STATUS_LABEL[code] ?? fallback ?? code;
}
