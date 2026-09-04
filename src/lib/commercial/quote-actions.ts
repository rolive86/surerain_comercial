"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createTelephoneQuote,
  saveQuoteForOrder,
  upsertCustomerPricing,
  type TelephoneQuoteLine,
} from "@/lib/commercial/quote";

function mapError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "Error desconocido";
  switch (msg) {
    case "AUTH_REQUIRED":
      return "Tenés que ingresar.";
    case "STAFF_REQUIRED":
      return "Se requiere rol de staff.";
    case "CUSTOMER_OUT_OF_PORTFOLIO":
      return "Ese cliente no está en tu cartera.";
    case "INVALID_MARKUP":
      return "El % markup debe ser un número entre 0 y 500.";
    case "ORDER_NOT_FOUND":
      return "Pedido no encontrado.";
    case "ORDER_NOT_QUOTABLE":
      return "Esta orden no se puede cotizar en su estado actual.";
    case "EMPTY_QUOTE":
      return "Agregá al menos un artículo.";
    case "INVALID_PRICE":
      return "Hay un precio inválido.";
    case "ORDER_NOT_QUOTED":
      return "Guardá la cotización antes de generar el PDF.";
    case "PHONE_REQUIRED":
      return "Ingresá el teléfono del cliente.";
    default:
      return msg;
  }
}

function isNextRedirect(err: unknown): boolean {
  return typeof err === "object" && err !== null && "digest" in err;
}

export async function saveCustomerPricingAction(formData: FormData) {
  const customerId = String(formData.get("customer_id") ?? "");
  try {
    await upsertCustomerPricing({
      customerId,
      markupPct: Number(formData.get("markup_pct")),
      currency: String(formData.get("currency") ?? "USD"),
    });
    revalidatePath(`/gestion/clientes/${customerId}`);
    redirect(`/gestion/clientes/${customerId}?ok=pricing`);
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    redirect(
      `/gestion/clientes/${customerId}?error=${encodeURIComponent(mapError(err))}`,
    );
  }
}

export async function saveQuoteAction(formData: FormData) {
  const orderId = String(formData.get("order_id") ?? "");
  const prices: Record<string, number | null> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("price_")) continue;
    const id = key.slice("price_".length);
    const raw = String(value).trim();
    prices[id] = raw === "" ? null : Number(raw);
  }
  try {
    await saveQuoteForOrder({ orderId, prices });
    revalidatePath(`/gestion/pedidos/${orderId}`);
    revalidatePath("/gestion/pedidos");
    redirect(`/gestion/pedidos/${orderId}?ok=prices`);
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    redirect(
      `/gestion/pedidos/${orderId}?error=${encodeURIComponent(mapError(err))}`,
    );
  }
}

export async function createTelephoneQuoteAction(formData: FormData) {
  const customerId = String(formData.get("customer_id") ?? "");
  const note = String(formData.get("note") ?? "");
  const codes = formData.getAll("cod_articulo").map(String);
  const qtys = formData.getAll("quantity").map(String);
  const names = formData.getAll("product_name").map(String);
  const lines: TelephoneQuoteLine[] = [];
  for (let i = 0; i < codes.length; i += 1) {
    const cod = codes[i]?.trim();
    if (!cod) continue;
    lines.push({
      cod_articulo: cod,
      quantity: Number(qtys[i] ?? 1),
      product_name: names[i] || undefined,
    });
  }
  try {
    const result = await createTelephoneQuote({ customerId, lines, note });
    revalidatePath("/gestion/pedidos");
    redirect(`/gestion/pedidos/${result.orderId}?ok=quoted`);
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    redirect(
      `/gestion/pedidos/nueva?error=${encodeURIComponent(mapError(err))}`,
    );
  }
}

export async function generateQuotePdfAction(formData: FormData) {
  const orderId = String(formData.get("order_id") ?? "");
  try {
    const { generateAndStoreQuotePdf } = await import("@/lib/commercial/quote-pdf");
    await generateAndStoreQuotePdf(orderId);
    revalidatePath(`/gestion/pedidos/${orderId}`);
    redirect(`/gestion/pedidos/${orderId}?ok=pdf`);
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    redirect(
      `/gestion/pedidos/${orderId}?error=${encodeURIComponent(mapError(err))}`,
    );
  }
}

export async function sendQuoteWhatsAppAction(formData: FormData): Promise<void> {
  const orderId = String(formData.get("order_id") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const savePhone = String(formData.get("save_phone_to_customer") ?? "") === "1";
  try {
    const { markQuoteSent } = await import("@/lib/commercial/quote-pdf");
    const result = await markQuoteSent({
      orderId,
      phone: phone.trim() || null,
      savePhoneToCustomer: savePhone,
    });
    revalidatePath(`/gestion/pedidos/${orderId}`);
    revalidatePath("/mis-pedidos");
    redirect(
      `/gestion/pedidos/${orderId}?ok=quoted&wa=${encodeURIComponent(result.waUrl)}`,
    );
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    const msg = mapError(err);
    const mapped =
      err instanceof Error && err.message === "PHONE_REQUIRED"
        ? "Ingresá el teléfono del cliente (formato Argentina)."
        : msg;
    redirect(
      `/gestion/pedidos/${orderId}?error=${encodeURIComponent(mapped)}`,
    );
  }
}
