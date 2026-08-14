import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getSupabaseEnv } from "./client";

/**
 * Server-side Supabase client using the anon key.
 * Respects RLS (public read of published catalog only).
 * Never use SERVICE_ROLE in UI components.
 */
export function createServerSupabaseClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
