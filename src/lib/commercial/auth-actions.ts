"use server";

import { redirect } from "next/navigation";
import { createCommercialServerClient } from "@/lib/supabase/commercial/server";

export async function signOutCommercial() {
  const supabase = await createCommercialServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
