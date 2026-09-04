import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { claimsFromAccessToken } from "@/lib/commercial/claims";
import {
  isBackofficePath,
  isCustomerPortalPath,
  isStaffRole,
  isVendedorAppContext,
  VENDEDOR_APP_COOKIE,
  VENDEDOR_APP_PARAM,
} from "@/lib/commercial/roles";

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

function redirectWithCookies(
  request: NextRequest,
  supabaseResponse: NextResponse,
  pathname: string,
  search?: Record<string, string>,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (search) {
    for (const [key, value] of Object.entries(search)) {
      url.searchParams.set(key, value);
    }
  }
  const response = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value);
  });
  return response;
}

function readVendedorApp(request: NextRequest): boolean {
  const fromQuery = request.nextUrl.searchParams.get("app");
  const fromCookie = request.cookies.get(VENDEDOR_APP_COOKIE)?.value;
  return (
    isVendedorAppContext(fromQuery) || isVendedorAppContext(fromCookie)
  );
}

function withVendedorCookie(response: NextResponse): NextResponse {
  response.cookies.set(VENDEDOR_APP_COOKIE, VENDEDOR_APP_PARAM, {
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    sameSite: "lax",
    secure: true,
  });
  return response;
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
  let role: string | null = null;
  if (user) {
    const { data: sessionData } = await supabase.auth.getSession();
    role = claimsFromAccessToken(sessionData.session?.access_token).app_role;
  }

  const bounce = (pathname: string, search?: Record<string, string>) =>
    redirectWithCookies(request, supabaseResponse, pathname, search);

  const vendedorApp = readVendedorApp(request);
  // Persist APK context when the TWA declares ?app=vendedor (or cookie already set).
  if (
    isVendedorAppContext(request.nextUrl.searchParams.get("app")) ||
    vendedorApp
  ) {
    withVendedorCookie(supabaseResponse);
  }

  // Staff does not land on the customer home (public catalog stays reachable).
  if (user && isStaffRole(role) && path === "/") {
    return bounce(role === "admin" ? "/gestion/dashboard" : "/gestion");
  }

  if (isBackofficePath(path)) {
    if (!user) {
      const search: Record<string, string> = { next: path };
      if (vendedorApp) search.app = VENDEDOR_APP_PARAM;
      const res = bounce("/login", search);
      if (vendedorApp) withVendedorCookie(res);
      return res;
    }
    if (!isStaffRole(role)) {
      return bounce("/");
    }
    if (
      (path === "/gestion/admin" || path.startsWith("/gestion/admin/")) &&
      role !== "admin" &&
      role !== "sales_manager"
    ) {
      return bounce("/gestion", { error: "admin_only" });
    }
    return supabaseResponse;
  }

  // Customer portal: login required; staff is sent to backoffice (not just hidden UI).
  if (isCustomerPortalPath(path)) {
    if (!user) {
      return bounce("/login", { next: path });
    }
    if (isStaffRole(role)) {
      return bounce("/gestion");
    }
    return supabaseResponse;
  }

  return supabaseResponse;
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
