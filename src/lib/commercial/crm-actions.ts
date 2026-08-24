"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addContact,
  assignSalesRep,
  createCustomer,
  createRep,
  deactivateContact,
  updateCustomer,
  updateRep,
} from "@/lib/commercial/crm";

function mapError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "Error desconocido";
  switch (msg) {
    case "AUTH_REQUIRED":
      return "Tenés que ingresar.";
    case "STAFF_REQUIRED":
      return "Se requiere rol de staff.";
    case "LEGAL_NAME_REQUIRED":
      return "La razón social es obligatoria.";
    case "CONTACT_NAME_REQUIRED":
      return "El nombre del contacto es obligatorio.";
    case "REP_REQUIRED":
      return "Seleccioná un vendedor.";
    case "REP_NAME_REQUIRED":
      return "El nombre del vendedor es obligatorio.";
    case "REP_INACTIVE":
      return "Ese vendedor no está activo. Elegí uno vigente.";
    case "REASSIGN_FORBIDDEN":
      return "Solo gerencia puede reasignar a otro vendedor.";
    case "ALREADY_ASSIGNED":
      return "Este cliente ya tiene vendedor. Pedí a gerencia la reasignación.";
    case "MANAGE_REPS_FORBIDDEN":
      return "Solo gerencia/ops/admin pueden crear vendedores.";
    case "UPDATE_REP_FORBIDDEN":
      return "No tenés permiso para editar este vendedor.";
    default:
      return msg;
  }
}

function isNextRedirect(err: unknown): boolean {
  return typeof err === "object" && err !== null && "digest" in err;
}

export async function createCustomerAction(formData: FormData) {
  try {
    const id = await createCustomer({
      customer: {
        legal_name: String(formData.get("legal_name") ?? ""),
        trade_name: String(formData.get("trade_name") ?? ""),
        cuit: String(formData.get("cuit") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        city: String(formData.get("city") ?? ""),
        province: String(formData.get("province") ?? ""),
        address: String(formData.get("address") ?? ""),
        active: formData.get("active") !== "false",
      },
      assignToSelf: formData.get("assign_to_self") !== "false",
      salesRepId: String(formData.get("sales_rep_id") ?? "") || null,
      contact: formData.get("contact_name")
        ? {
            name: String(formData.get("contact_name") ?? ""),
            email: String(formData.get("contact_email") ?? ""),
            phone: String(formData.get("contact_phone") ?? ""),
            position: String(formData.get("contact_position") ?? ""),
            is_primary: true,
          }
        : null,
    });
    revalidatePath("/gestion/clientes");
    redirect(`/gestion/clientes/${id}?ok=created`);
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    redirect(
      `/gestion/clientes/nuevo?error=${encodeURIComponent(mapError(err))}`,
    );
  }
}

export async function updateCustomerAction(formData: FormData) {
  const customerId = String(formData.get("customer_id") ?? "");
  try {
    await updateCustomer(customerId, {
      legal_name: String(formData.get("legal_name") ?? ""),
      trade_name: String(formData.get("trade_name") ?? ""),
      cuit: String(formData.get("cuit") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      city: String(formData.get("city") ?? ""),
      province: String(formData.get("province") ?? ""),
      address: String(formData.get("address") ?? ""),
      active: formData.get("active") === "true" || formData.get("active") === "on",
    });
    revalidatePath("/gestion/clientes");
    revalidatePath(`/gestion/clientes/${customerId}`);
    redirect(`/gestion/clientes/${customerId}?ok=updated`);
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    redirect(
      `/gestion/clientes/${customerId}?error=${encodeURIComponent(mapError(err))}`,
    );
  }
}

export async function addContactAction(formData: FormData) {
  const customerId = String(formData.get("customer_id") ?? "");
  try {
    await addContact(customerId, {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      position: String(formData.get("position") ?? ""),
      is_primary: formData.get("is_primary") === "on",
    });
    revalidatePath(`/gestion/clientes/${customerId}`);
    redirect(`/gestion/clientes/${customerId}?ok=contact`);
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    redirect(
      `/gestion/clientes/${customerId}?error=${encodeURIComponent(mapError(err))}`,
    );
  }
}

export async function deactivateContactAction(formData: FormData) {
  const customerId = String(formData.get("customer_id") ?? "");
  const contactId = String(formData.get("contact_id") ?? "");
  try {
    await deactivateContact(customerId, contactId);
    revalidatePath(`/gestion/clientes/${customerId}`);
    redirect(`/gestion/clientes/${customerId}?ok=contact_off`);
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    redirect(
      `/gestion/clientes/${customerId}?error=${encodeURIComponent(mapError(err))}`,
    );
  }
}

export async function assignSalesRepAction(formData: FormData) {
  const customerId = String(formData.get("customer_id") ?? "");
  const salesRepId = String(formData.get("sales_rep_id") ?? "");
  const returnTo = String(formData.get("return_to") ?? "").trim();
  try {
    await assignSalesRep(customerId, salesRepId);
    revalidatePath("/gestion/clientes");
    revalidatePath(`/gestion/clientes/${customerId}`);
    revalidatePath("/gestion/vendedores");
    if (returnTo.startsWith("/gestion/")) {
      redirect(returnTo);
    }
    redirect(`/gestion/clientes/${customerId}?ok=assign`);
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    if (returnTo.startsWith("/gestion/")) {
      const sep = returnTo.includes("?") ? "&" : "?";
      redirect(
        `${returnTo}${sep}error=${encodeURIComponent(mapError(err))}`,
      );
    }
    redirect(
      `/gestion/clientes/${customerId}?error=${encodeURIComponent(mapError(err))}`,
    );
  }
}

export async function createRepAction(formData: FormData) {
  try {
    const id = await createRep({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      active: formData.get("active") !== "false",
    });
    revalidatePath("/gestion/vendedores");
    redirect(`/gestion/vendedores/${id}?ok=created`);
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    redirect(
      `/gestion/vendedores/nuevo?error=${encodeURIComponent(mapError(err))}`,
    );
  }
}

export async function updateRepAction(formData: FormData) {
  const repId = String(formData.get("rep_id") ?? "");
  try {
    await updateRep(repId, {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      active:
        formData.get("active") === "true" || formData.get("active") === "on",
    });
    revalidatePath("/gestion/vendedores");
    revalidatePath(`/gestion/vendedores/${repId}`);
    redirect(`/gestion/vendedores/${repId}?ok=updated`);
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    redirect(
      `/gestion/vendedores/${repId}?error=${encodeURIComponent(mapError(err))}`,
    );
  }
}
