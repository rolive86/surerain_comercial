export type CommercialClaims = {
  app_role: string | null;
  customer_id: string | null;
  sales_rep_id: string | null;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function claimsFromAccessToken(
  accessToken: string | null | undefined,
): CommercialClaims {
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
