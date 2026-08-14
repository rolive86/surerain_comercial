import { createCommercialServerClient } from "@/lib/supabase/commercial/server";

export type CommercialClaims = {
  app_role: string | null;
  customer_id: string | null;
  sales_rep_id: string | null;
};

export type CommercialSession = {
  user: {
    id: string;
    email: string | null;
  };
  claims: CommercialClaims;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function claimsFromAccessToken(accessToken: string | null | undefined): CommercialClaims {
  if (!accessToken) {
    return { app_role: null, customer_id: null, sales_rep_id: null };
  }
  const claims = decodeJwtPayload(accessToken);
  return {
    app_role: (claims?.app_role as string | undefined) ?? null,
    customer_id: (claims?.customer_id as string | undefined) ?? null,
    sales_rep_id: (claims?.sales_rep_id as string | undefined) ?? null,
  };
}

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
