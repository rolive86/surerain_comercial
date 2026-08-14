import { getSupabaseEnv } from "@/lib/supabase/client";

export function publicStorageUrl(
  bucket: string | null | undefined,
  storagePath: string | null | undefined,
): string | null {
  if (!bucket || !storagePath) return null;
  const { url } = getSupabaseEnv();
  const base = url.replace(/\/$/, "");
  const path = storagePath.replace(/^\//, "");
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
