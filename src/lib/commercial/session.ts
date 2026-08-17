import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import {
  claimsFromAccessToken,
  type CommercialClaims,
} from "@/lib/commercial/claims";

export type { CommercialClaims };

export type CommercialSession = {
  user: {
    id: string;
    email: string | null;
  };
  claims: CommercialClaims;
};

/** Current commercial session (cookies). Null if anonymous. */
export async function getCommercialSession(): Promise<CommercialSession | null> {
  const supabase = await createCommercialServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const claims = claimsFromAccessToken(sessionData.session?.access_token);

  return {
    user: { id: user.id, email: user.email ?? null },
    claims,
  };
}

/** Nombre corto para saludo. Hasta user_profiles (Pass 2): parte local del email. */
export function displayNameFromEmail(email: string | null | undefined): string {
  if (!email) return "ahí";
  const local = email.split("@")[0] ?? "";
  const token = local.split(/[._-]/)[0] || local;
  if (!token) return "ahí";
  return token.charAt(0).toUpperCase() + token.slice(1);
}

export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case "customer_user":
      return "Cliente";
    case "sales_rep":
      return "Vendedor";
    case "sales_manager":
      return "Gerente comercial";
    case "operations":
      return "Operaciones";
    case "admin":
      return "Admin";
    default:
      return role ?? "Usuario";
  }
}
