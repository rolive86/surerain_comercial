"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addInternalOrderNote, changeOrderStatus } from "@/lib/commercial/backoffice";

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
