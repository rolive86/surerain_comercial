"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  confirmOpenCart,
  mergeGuestCartItems,
  removeCartItem,
  setCartItemQuantity,
  upsertCartItem,
  type CartItemInput,
} from "@/lib/commercial/cart";

export type ActionResult =
  | { ok: true; message?: string; orderId?: string; orderNumber?: string }
  | { ok: false; error: string };

function mapError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "Error desconocido";
  switch (msg) {
    case "AUTH_REQUIRED":
      return "Tenés que ingresar para usar el carrito.";
    case "CUSTOMER_ROLE_REQUIRED":
      return "El carrito está disponible para usuarios cliente.";
    case "EMPTY_CART":
      return "El carrito está vacío.";
    default:
      return msg;
  }
}

export async function addToCartAction(input: CartItemInput): Promise<ActionResult> {
  try {
    await upsertCartItem(input);
    revalidatePath("/carrito");
    revalidatePath("/", "layout");
    return { ok: true, message: "Agregado al carrito" };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function updateCartQtyAction(itemId: string, quantity: number): Promise<ActionResult> {
  try {
    await setCartItemQuantity(itemId, quantity);
    revalidatePath("/carrito");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function removeCartItemAction(itemId: string): Promise<ActionResult> {
  try {
    await removeCartItem(itemId);
    revalidatePath("/carrito");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function mergeGuestCartAction(items: CartItemInput[]): Promise<ActionResult> {
  try {
    await mergeGuestCartItems(items);
    revalidatePath("/carrito");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function confirmCartAction(formData: FormData): Promise<void> {
  const note = String(formData.get("customer_note") ?? "");
  try {
    const result = await confirmOpenCart(note || undefined);
    revalidatePath("/carrito");
    revalidatePath("/", "layout");
    redirect(`/pedido/${result.orderId}`);
  } catch (err) {
    if (typeof err === "object" && err && "digest" in err) throw err; // next redirect
    redirect(`/carrito?error=${encodeURIComponent(mapError(err))}`);
  }
}
