/** Normaliza teléfono AR a dígitos internacionales (+54…). Shared client/server. */
export function normalizeArWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits.startsWith("54")) {
    if (digits.startsWith("0")) digits = digits.slice(1);
    digits = `54${digits}`;
  }
  if (digits.startsWith("54") && !digits.startsWith("549") && digits.length >= 12) {
    digits = `549${digits.slice(2)}`;
  }
  if (digits.length < 11) return null;
  return digits;
}
