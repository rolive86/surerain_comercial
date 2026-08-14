import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/commercial.types";

export function getCommercialSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_COMMERCIAL_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_COMMERCIAL_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_COMMERCIAL_SUPABASE_URL or NEXT_PUBLIC_COMMERCIAL_SUPABASE_ANON_KEY in .env.local",
    );
  }
  return { url, anonKey };
}

/** Browser client for commercial Auth / RLS-scoped data (cookie session via @supabase/ssr). */
export function createCommercialBrowserClient() {
  const { url, anonKey } = getCommercialSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
