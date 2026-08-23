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
import { getCommercialSession } from "@/lib/commercial/session";

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

export async function reorderFromSalesAction(formData: FormData): Promise<void> {
  const nro = String(formData.get("nro_comprobante") ?? "").trim();
  try {
    const session = await getCommercialSession();
    if (!session || session.claims.app_role !== "customer_user" || !session.claims.customer_id) {
      throw new Error("AUTH_REQUIRED");
    }
    const { createCommercialServerClient } = await import(
      "@/lib/supabase/commercial/server"
    );
    const { getTangoProductsByCodes } = await import("@/lib/commercial/products-tango");
    const supabase = await createCommercialServerClient();
    const { data: lines, error } = await supabase
      .from("sales_history")
      .select("cod_articulo, cantidad, tipo_comprobante")
      .eq("customer_id", session.claims.customer_id)
      .eq("nro_comprobante", nro);
    if (error) throw new Error(error.message);
    if (!lines?.length) throw new Error("Comprobante no encontrado.");

    const codes = lines
      .filter((l) => l.cod_articulo && !(l.tipo_comprobante ?? "").toUpperCase().startsWith("NC"))
      .map((l) => l.cod_articulo as string);
    const products = await getTangoProductsByCodes(codes);
    const byCode = new Map(products.map((p) => [p.source_id, p]));

    let added = 0;
    let missing = 0;
    for (const line of lines) {
      if (!line.cod_articulo) continue;
      if ((line.tipo_comprobante ?? "").toUpperCase().startsWith("NC")) continue;
      const product = byCode.get(line.cod_articulo);
      const qty = Math.max(1, Math.floor(Number(line.cantidad) || 1));
      if (!product) {
        missing += 1;
        continue;
      }
      await upsertCartItem({
        product_source_id: product.source_id,
        product_name_snapshot: product.name,
        product_slug_snapshot: product.slug,
        quantity: qty,
      });
      added += 1;
    }
    revalidatePath("/carrito");
    revalidatePath("/", "layout");
    const params = new URLSearchParams();
    if (added) params.set("ok", "reorder");
    if (missing) params.set("faltan", String(missing));
    if (!added) params.set("error", "Ningún artículo de ese comprobante está pedible hoy.");
    redirect(`/carrito?${params.toString()}`);
  } catch (err) {
    if (typeof err === "object" && err && "digest" in err) throw err;
    redirect(
      `/mis-compras?error=${encodeURIComponent(mapError(err))}`,
    );
  }
}

export async function reorderOrderAction(formData: FormData): Promise<void> {
  const orderId = String(formData.get("order_id") ?? "");
  try {
    const { getCustomerOrderDetail } = await import("@/lib/commercial/orders");
    const { getTangoProductsByCodes } = await import("@/lib/commercial/products-tango");
    const { getCatalogProductsBySourceIds } = await import("@/lib/catalog");
    const order = await getCustomerOrderDetail(orderId);
    if (!order) throw new Error("Pedido no encontrado.");
    const ids = order.items.map((i) => i.product_source_id);
    const [tangoProducts, catalogProducts] = await Promise.all([
      getTangoProductsByCodes(ids),
      getCatalogProductsBySourceIds(ids),
    ]);
    const byId = new Map<string, { name: string; slug: string }>();
    for (const p of catalogProducts) byId.set(p.source_id, { name: p.name, slug: p.slug });
    for (const p of tangoProducts) byId.set(p.source_id, { name: p.name, slug: p.slug });
    let added = 0;
    let missing = 0;
    for (const item of order.items) {
      const product = byId.get(item.product_source_id);
      if (!product) {
        missing += 1;
        continue;
      }
      await upsertCartItem({
        product_source_id: item.product_source_id,
        product_name_snapshot: product.name ?? item.product_name_snapshot,
        product_slug_snapshot: product.slug ?? item.product_slug_snapshot,
        quantity: item.quantity,
      });
      added += 1;
    }
    revalidatePath("/carrito");
    revalidatePath("/", "layout");
    const params = new URLSearchParams();
    if (added) params.set("ok", "reorder");
    if (missing) params.set("faltan", String(missing));
    if (!added) params.set("error", "Ningún producto de ese pedido sigue disponible.");
    redirect(`/carrito?${params.toString()}`);
  } catch (err) {
    if (typeof err === "object" && err && "digest" in err) throw err;
    redirect(`/pedido/${orderId}?error=${encodeURIComponent(mapError(err))}`);
  }
}
