"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createCommercialBrowserClient } from "@/lib/supabase/commercial/client";

const REFRESH_DEBOUNCE_MS = 800;
const CRITICAL_PREFIXES = [
  "/gestion",
  "/gestion/stock",
  "/gestion/pulseada",
  "/gestion/rendicion",
] as const;

function isVendedorCriticalPath(pathname: string): boolean {
  return CRITICAL_PREFIXES.some(
    (p) => pathname === p || (p !== "/gestion" && pathname.startsWith(`${p}/`)),
  );
}

/**
 * Capa mínima de sincronización UI para el módulo Vendedor (TWA/PWA):
 * - Realtime selectivo (products_tango → Stock; sales_history → Home/Pulseada)
 * - Refresh al volver de background / online / visible / TOKEN_REFRESHED
 * - Banner claro si no hay red (sin presentar cache como vigente)
 */
export function VendedorLiveSync() {
  const router = useRouter();
  const pathname = usePathname();
  const [offline, setOffline] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefresh = useRef(0);

  function scheduleRefresh(reason: string) {
    if (!isVendedorCriticalPath(pathname)) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOffline(true);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const now = Date.now();
      if (now - lastRefresh.current < REFRESH_DEBOUNCE_MS) return;
      lastRefresh.current = now;
      setRefreshing(true);
      setRefreshError(null);
      try {
        router.refresh();
      } catch {
        setRefreshError("No se pudo actualizar. Reintentá.");
      } finally {
        // router.refresh is sync-schedule; give UI a beat
        setTimeout(() => setRefreshing(false), 400);
      }
      void reason;
    }, REFRESH_DEBOUNCE_MS);
  }

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => {
      setOffline(false);
      scheduleRefresh("online");
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        scheduleRefresh("visible");
      }
    };
    const onFocus = () => scheduleRefresh("focus");
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) scheduleRefresh("pageshow");
    };

    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pathname]);

  useEffect(() => {
    if (!isVendedorCriticalPath(pathname)) return;

    const supabase = createCommercialBrowserClient();
    const channel = supabase
      .channel(`vendedor-live:${pathname}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products_tango" },
        () => {
          if (pathname === "/gestion/stock" || pathname.startsWith("/gestion/stock")) {
            scheduleRefresh("products_tango");
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales_history" },
        () => {
          if (
            pathname === "/gestion" ||
            pathname === "/gestion/pulseada" ||
            pathname.startsWith("/gestion/pulseada")
          ) {
            scheduleRefresh("sales_history");
          }
        },
      )
      .subscribe();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "TOKEN_REFRESHED" ||
        event === "SIGNED_IN" ||
        event === "USER_UPDATED"
      ) {
        scheduleRefresh(`auth:${event}`);
      }
    });

    return () => {
      void supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, [pathname]);

  if (!offline && !refreshError && !refreshing) return null;

  return (
    <div
      className="fixed inset-x-0 top-14 z-[60] px-3 lg:top-0"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      role="status"
      aria-live="polite"
    >
      <div
        className={`mx-auto flex max-w-lg items-center justify-between gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold shadow-sm ${
          offline || refreshError
            ? "bg-amber-50 text-amber-950 ring-1 ring-amber-200"
            : "bg-white/95 text-sr-ink/70 ring-1 ring-sr-mist"
        }`}
      >
        <p className="min-w-0 flex-1 leading-snug">
          {offline
            ? "Sin conexión. Los datos pueden no estar actualizados."
            : refreshError
              ? refreshError
              : "Actualizando…"}
        </p>
        {(offline || refreshError) && (
          <button
            type="button"
            className="shrink-0 rounded-lg bg-sr-green px-2.5 py-1.5 text-[11px] font-semibold text-white"
            onClick={() => {
              setOffline(!navigator.onLine);
              if (navigator.onLine) scheduleRefresh("retry");
            }}
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}
