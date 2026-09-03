/** LLM de visión solo si el flag está prendido (apagado por defecto = $0). */
export function isRendicionLlmOcrEnabled(): boolean {
  const v = process.env.RENDICION_OCR_LLM?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
