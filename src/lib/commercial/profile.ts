import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { commercialPublicStorageUrl } from "@/lib/storage";
import {
  displayNameFromEmail,
  getCommercialSession,
} from "@/lib/commercial/session";
import type { Json } from "@/types/commercial.types";

export type UserProfile = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  position: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
  interests: string[];
  marketing_opt_in: boolean;
};

function asStringArray(value: Json): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export async function getOwnProfile(): Promise<UserProfile | null> {
  const session = await getCommercialSession();
  if (!session) return null;
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "user_id, full_name, phone, position, avatar_path, interests, marketing_opt_in",
    )
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    user_id: data.user_id,
    full_name: data.full_name,
    phone: data.phone,
    position: data.position,
    avatar_path: data.avatar_path,
    avatar_url: commercialPublicStorageUrl("avatars", data.avatar_path),
    interests: asStringArray(data.interests),
    marketing_opt_in: data.marketing_opt_in,
  };
}

export async function getGreetingName(email: string | null): Promise<string> {
  const profile = await getOwnProfile();
  const fromProfile = profile?.full_name?.trim().split(/\s+/)[0];
  if (fromProfile) return fromProfile;
  return displayNameFromEmail(email);
}
