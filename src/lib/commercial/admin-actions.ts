"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createCommercialAdminClient } from "@/lib/supabase/commercial/admin";
import { getCommercialSession } from "@/lib/commercial/session";
import { requireAdminConsoleSession } from "@/lib/commercial/backoffice";
import { previewMarginImpact } from "@/lib/commercial/admin-console";

function mapError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "Error desconocido";
  switch (msg) {
    case "AUTH_REQUIRED":
      return "Tenés que ingresar.";
    case "STAFF_REQUIRED":
    case "ADMIN_CONSOLE_REQUIRED":
      return "Solo admin o gerente comercial.";
    default:
      return msg;
  }
}

function isNextRedirect(err: unknown): boolean {
  return typeof err === "object" && err !== null && "digest" in err;
}

function bounce(path: string, err: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(mapError(err))}`);
}

async function recompute() {
  const supabase = createCommercialAdminClient();
  const { error } = await supabase.rpc("recompute_effective_prices");
  if (error) throw new Error(error.message);
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export async function previewMarginImpactAction(formData: FormData) {
  try {
    const session = await getCommercialSession();
    requireAdminConsoleSession(session);
    const percent = Number(String(formData.get("percent") ?? "").replace(",", "."));
    if (!Number.isFinite(percent)) throw new Error("El % es obligatorio.");
    if (percent < -100 || percent > 500) throw new Error("El % tiene que estar entre −100 y 500.");
    const preview = await previewMarginImpact({
      id: emptyToNull(formData.get("id")),
      scope: String(formData.get("scope") ?? "global"),
      percent,
      category: emptyToNull(formData.get("category")),
      cod_articulo: emptyToNull(formData.get("cod_articulo")),
      customer_id: emptyToNull(formData.get("customer_id")),
    });
    return { preview, error: null as string | null };
  } catch (err) {
    return { preview: null, error: mapError(err) };
  }
}

export async function upsertMarginAction(formData: FormData) {
  const session = await getCommercialSession();
  try {
    requireAdminConsoleSession(session);
    const id = emptyToNull(formData.get("id"));
    const scope = String(formData.get("scope") ?? "global");
    const percent = Number(String(formData.get("percent") ?? "").replace(",", "."));
    if (!Number.isFinite(percent)) throw new Error("El % es obligatorio.");
    if (percent < -100 || percent > 500) throw new Error("El % tiene que estar entre −100 y 500.");
    if ((percent < 0 || percent > 100) && formData.get("confirm_extreme") !== "on") {
      throw new Error("Confirmá el margen excepcional (negativo o mayor a 100).");
    }
    const supabase = createCommercialAdminClient();
    const payload = {
      scope,
      percent,
      category: scope === "category" ? emptyToNull(formData.get("category")) : null,
      cod_articulo: scope === "product" ? emptyToNull(formData.get("cod_articulo")) : null,
      customer_id: scope === "customer" ? emptyToNull(formData.get("customer_id")) : null,
      active: formData.get("active") !== "false",
    };
    if (scope === "category" && !payload.category) throw new Error("Indicá la categoría.");
    if (scope === "product" && !payload.cod_articulo) throw new Error("Indicá el código Tango.");
    if (scope === "customer" && !payload.customer_id) throw new Error("Indicá el cliente.");
    if (id) {
      const { error } = await supabase.from("margins").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("margins").insert(payload);
      if (error) throw new Error(error.message);
    }
    await recompute();
    revalidatePath("/gestion/admin");
    redirect("/gestion/admin/margenes?ok=saved");
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    bounce("/gestion/admin/margenes", err);
  }
}

export async function deleteMarginAction(formData: FormData) {
  const session = await getCommercialSession();
  try {
    requireAdminConsoleSession(session);
    const id = emptyToNull(formData.get("id"));
    if (!id) throw new Error("Falta el margen.");
    const supabase = createCommercialAdminClient();
    const { error } = await supabase.from("margins").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await recompute();
    revalidatePath("/gestion/admin");
    redirect("/gestion/admin/margenes?ok=deleted");
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    bounce("/gestion/admin/margenes", err);
  }
}

export async function confirmMapAction(formData: FormData) {
  const session = await getCommercialSession();
  try {
    requireAdminConsoleSession(session);
    const sourceId = emptyToNull(formData.get("source_id"));
    if (!sourceId) throw new Error("Falta source_id.");
    const supabase = createCommercialAdminClient();
    const { error } = await supabase
      .from("product_map")
      .update({ confirmed: true })
      .eq("source_id", sourceId);
    if (error) throw new Error(error.message);
    revalidatePath("/gestion/admin/mapeo");
    redirect("/gestion/admin/mapeo?ok=confirmed");
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    bounce("/gestion/admin/mapeo", err);
  }
}

export async function rejectMapAction(formData: FormData) {
  const session = await getCommercialSession();
  try {
    requireAdminConsoleSession(session);
    const sourceId = emptyToNull(formData.get("source_id"));
    if (!sourceId) throw new Error("Falta source_id.");
    const supabase = createCommercialAdminClient();
    const { error } = await supabase.from("product_map").delete().eq("source_id", sourceId);
    if (error) throw new Error(error.message);
    revalidatePath("/gestion/admin/mapeo");
    redirect("/gestion/admin/mapeo?vista=sin_match&ok=rejected");
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    bounce("/gestion/admin/mapeo", err);
  }
}

export async function manualMapAction(formData: FormData) {
  const session = await getCommercialSession();
  try {
    requireAdminConsoleSession(session);
    const sourceId = emptyToNull(formData.get("source_id"));
    const catalogName = emptyToNull(formData.get("catalog_name"));
    const cod = emptyToNull(formData.get("cod_articulo"));
    if (!sourceId || !cod) throw new Error("source_id y cod_articulo son obligatorios.");
    const supabase = createCommercialAdminClient();
    const { data: arts } = await supabase.rpc("tango_staging_fetch", { p_entity: "articulos" });
    const { data: specs } = await supabase.rpc("tango_staging_fetch", {
      p_entity: "articulos_specs",
    });
    let tangoDesc: string | null = null;
    for (const raw of [...(Array.isArray(arts) ? arts : []), ...(Array.isArray(specs) ? specs : [])]) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      if (String(r.cod_articulo ?? "").trim() === cod) {
        tangoDesc = r.descripcion ? String(r.descripcion) : tangoDesc;
      }
    }
    const { error } = await supabase.from("product_map").upsert({
      source_id: sourceId,
      cod_articulo: cod,
      catalog_name: catalogName,
      tango_desc: tangoDesc,
      match_method: "manual",
      confidence: 1,
      confirmed: true,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/gestion/admin/mapeo");
    redirect("/gestion/admin/mapeo?vista=confirmados&ok=manual");
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    bounce("/gestion/admin/mapeo", err);
  }
}

export async function saveModulePermissionsAction(formData: FormData) {
  const session = await getCommercialSession();
  try {
    requireAdminConsoleSession(session);
    const supabase = createCommercialAdminClient();
    const { data: modules, error: mErr } = await supabase.from("app_modules").select("code");
    if (mErr) throw new Error(mErr.message);
    const roles = ["customer_user", "sales_rep", "sales_manager", "operations", "admin"];
    const rows = [];
    for (const role of roles) {
      for (const mod of modules ?? []) {
        const viewKey = `view:${role}:${mod.code}`;
        const editKey = `edit:${role}:${mod.code}`;
        rows.push({
          role,
          module: mod.code,
          can_view: formData.get(viewKey) === "on",
          can_edit: formData.get(editKey) === "on",
        });
      }
    }
    const { error } = await supabase.from("module_permissions").upsert(rows, {
      onConflict: "role,module",
    });
    if (error) throw new Error(error.message);
    revalidatePath("/");
    revalidatePath("/gestion");
    revalidatePath("/gestion/admin/permisos");
    redirect("/gestion/admin/permisos?ok=saved");
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    bounce("/gestion/admin/permisos", err);
  }
}
