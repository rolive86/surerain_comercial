import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/commercial.types";

/**
 * Service-role client for commercial DB.
 * SERVER ONLY — never import from Client Components.
 */
export function createCommercialAdminClient() {
  const url = process.env.NEXT_PUBLIC_COMMERCIAL_SUPABASE_URL;
  const serviceKey = process.env.COMMERCIAL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_COMMERCIAL_SUPABASE_URL or COMMERCIAL_SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
