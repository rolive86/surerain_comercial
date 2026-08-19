"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addInternalOrderNote,
  changeOrderStatus,
  updateOrderItemQuantities,
} from "@/lib/commercial/backoffice";

function mapError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "Error desconocido";
  switch (msg) {
    case "AUTH_REQUIRED":
      return "Tenés que ingresar.";
    case "STAFF_REQUIRED":
      return "Se requiere rol de staff.";
    case "ORDER_NOT_FOUND":
      return "Pedido no encontrado o fuera de alcance.";
    case "STATUS_UNCHANGED":
      return "El pedido ya está en ese estado.";
    case "INVALID_STATUS":
      return "Estado inválido.";
    case "EMPTY_NOTE":
      return "La nota no puede estar vacía.";
    case "ORDER_LOCKED":
      return "Este pedido ya no admite cambios de cantidad.";
    case "INVALID_QUANTITY":
      return "La cantidad tiene que ser un entero mayor a 0.";
    case "QUANTITY_UNCHANGED":
      return "No hay cambios de cantidad para guardar.";
    default:
      return msg;
  }
}

function isNextRedirect(err: unknown): boolean {
  return typeof err === "object" && err !== null && "digest" in err;
}

export async function changeOrderStatusAction(formData: FormData) {
  const orderId = String(formData.get("order_id") ?? "");
  const toStatus = String(formData.get("to_status") ?? "");
  const comment = String(formData.get("comment") ?? "");
  try {
    await changeOrderStatus({ orderId, toStatus, comment });
    revalidatePath("/gestion/pedidos");
    revalidatePath(`/gestion/pedidos/${orderId}`);
    redirect(`/gestion/pedidos/${orderId}?ok=status`);
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    redirect(`/gestion/pedidos/${orderId}?error=${encodeURIComponent(mapError(err))}`);
  }
}

export async function updateOrderQuantitiesAction(formData: FormData) {
  const orderId = String(formData.get("order_id") ?? "");
  const quantities: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("qty_")) continue;
    quantities[key.slice(4)] = Number(value);
  }
  try {
    await updateOrderItemQuantities(orderId, quantities);
    revalidatePath("/gestion/pedidos");
    revalidatePath(`/gestion/pedidos/${orderId}`);
    revalidatePath(`/pedido/${orderId}`);
    redirect(`/gestion/pedidos/${orderId}?ok=qty`);
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    redirect(`/gestion/pedidos/${orderId}?error=${encodeURIComponent(mapError(err))}`);
  }
}

export async function addInternalNoteAction(formData: FormData) {
  const orderId = String(formData.get("order_id") ?? "");
  const body = String(formData.get("body") ?? "");
  try {
    await addInternalOrderNote(orderId, body);
    revalidatePath(`/gestion/pedidos/${orderId}`);
    redirect(`/gestion/pedidos/${orderId}?ok=note`);
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    redirect(`/gestion/pedidos/${orderId}?error=${encodeURIComponent(mapError(err))}`);
  }
}
