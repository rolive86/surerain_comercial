export const PRICE_TO_CONFIRM = "Precio a confirmar";

export function isValidFinalAmount(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isFinite(amount) && amount > 0;
}

export function formatFinalUsd(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Nunca $0 / NaN / vacío: sin precio de lista es un estado válido. */
export function displayFinalUsd(amount: number | null | undefined): string {
  if (!isValidFinalAmount(amount)) return PRICE_TO_CONFIRM;
  return formatFinalUsd(amount);
}

