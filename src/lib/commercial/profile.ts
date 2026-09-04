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
  updated_at: string | null;
};

export type HeaderIdentity = {
  displayName: string;
  avatarUrl: string | null;
};

function asStringArray(value: Json): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName.trim();
}

function avatarPublicUrl(avatarPath: string | null, updatedAt: string | null): string | null {
  const url = commercialPublicStorageUrl("avatars", avatarPath);
  if (!url) return null;
  if (!updatedAt) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${encodeURIComponent(updatedAt)}`;
}

export async function getOwnProfile(): Promise<UserProfile | null> {
  const session = await getCommercialSession();
  if (!session) return null;
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "user_id, full_name, phone, position, avatar_path, interests, marketing_opt_in, updated_at",
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
    avatar_url: avatarPublicUrl(data.avatar_path, data.updated_at),
    interests: asStringArray(data.interests),
    marketing_opt_in: data.marketing_opt_in,
    updated_at: data.updated_at,
  };
}

/** Nombre para saludo: perfil → empresa → email. Nunca el label de rol. */
export async function getHeaderIdentity(): Promise<HeaderIdentity | null> {
  const session = await getCommercialSession();
  if (!session) return null;

  const supabase = await createCommercialServerClient();
  const [{ data: profile }, company] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("full_name, avatar_path, updated_at")
      .eq("user_id", session.user.id)
      .maybeSingle(),
    session.claims.customer_id
      ? supabase
          .from("customers")
          .select("trade_name, legal_name")
          .eq("id", session.claims.customer_id)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const fromProfile = profile?.full_name?.trim();
  const fromCompany = company?.trade_name?.trim() || company?.legal_name?.trim();
  const fromEmail = session.user.email?.split("@")[0]?.trim();
  const displayName = fromProfile
    ? firstName(fromProfile)
    : fromCompany || fromEmail || "ahí";

  return {
    displayName,
    avatarUrl: avatarPublicUrl(profile?.avatar_path ?? null, profile?.updated_at ?? null),
  };
}

export async function getGreetingName(email: string | null): Promise<string> {
  const identity = await getHeaderIdentity();
  if (identity?.displayName) return identity.displayName;
  return displayNameFromEmail(email);
}
