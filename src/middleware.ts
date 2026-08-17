import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { claimsFromAccessToken } from "@/lib/commercial/claims";
import {
  isBackofficePath,
  isCustomerPortalPath,
  isStaffRole,
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

  // Staff does not land on the customer home (public catalog stays reachable).
  if (user && isStaffRole(role) && path === "/") {
    return bounce("/gestion");
  }

  if (isBackofficePath(path)) {
    if (!user) {
      return bounce("/login", { next: path });
    }
    if (!isStaffRole(role)) {
      return bounce("/");
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
