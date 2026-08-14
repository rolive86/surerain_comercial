import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const STAFF_ROLES = new Set(["sales_rep", "sales_manager", "operations", "admin"]);

function getCommercialEnv() {
  const url = process.env.NEXT_PUBLIC_COMMERCIAL_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_COMMERCIAL_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_COMMERCIAL_SUPABASE_URL or NEXT_PUBLIC_COMMERCIAL_SUPABASE_ANON_KEY",
    );
  }
  return { url, anonKey };
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { url, anonKey } = getCommercialEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh commercial session (required for SSR cookie auth).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Public catalog routes — never block.
  if (path === "/" || path === "/catalogo" || path.startsWith("/catalogo/")) {
    return supabaseResponse;
  }

  // /gestion/* requires authenticated staff role (placeholder for backoffice).
  if (path.startsWith("/gestion")) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", path);
      return NextResponse.redirect(redirectUrl);
    }

    const role =
      (user.app_metadata?.app_role as string | undefined) ??
      ((user as { app_role?: string }).app_role) ??
      null;

    // Prefer JWT custom claim via getSession if present
    const { data: sessionData } = await supabase.auth.getSession();
    const jwtRole =
      (sessionData.session?.access_token
        ? decodeJwtPayload(sessionData.session.access_token)?.app_role
        : null) ?? role;

    if (!jwtRole || !STAFF_ROLES.has(String(jwtRole))) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("error", "staff_required");
      return NextResponse.redirect(redirectUrl);
    }
  }

  // /cuenta requires any authenticated commercial user.
  if (path.startsWith("/cuenta") && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

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

export const config = {
  matcher: [
    /*
     * Match all paths except static assets.
     * Catalog stays public; middleware still refreshes commercial session cookies.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
