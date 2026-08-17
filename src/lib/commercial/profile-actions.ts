"use server";

import { revalidatePath } from "next/cache";
import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { getCommercialSession } from "@/lib/commercial/session";
import { PROFILE_INTERESTS } from "@/lib/commercial/profile-constants";

export async function saveProfileAction(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await getCommercialSession();
    if (!session) return { ok: false, error: "Tenés que ingresar." };

    const interests = PROFILE_INTERESTS.filter((i) => formData.get(`interest_${i}`) === "on");
    const supabase = await createCommercialServerClient();
    const { error } = await supabase.from("user_profiles").upsert(
      {
        user_id: session.user.id,
        full_name: String(formData.get("full_name") ?? "").trim() || null,
        phone: String(formData.get("phone") ?? "").trim() || null,
        position: String(formData.get("position") ?? "").trim() || null,
        interests,
        marketing_opt_in: formData.get("marketing_opt_in") === "on",
      },
      { onConflict: "user_id" },
    );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/", "layout");
    revalidatePath("/cuenta");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al guardar." };
  }
}

export async function saveAvatarPathAction(path: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await getCommercialSession();
    if (!session) return { ok: false, error: "Tenés que ingresar." };
    const supabase = await createCommercialServerClient();
    const { data: existing } = await supabase
      .from("user_profiles")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();
    const { error } = existing
      ? await supabase
          .from("user_profiles")
          .update({ avatar_path: path })
          .eq("user_id", session.user.id)
      : await supabase.from("user_profiles").insert({
          user_id: session.user.id,
          avatar_path: path,
        });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/", "layout");
    revalidatePath("/cuenta");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al guardar el avatar." };
  }
}
