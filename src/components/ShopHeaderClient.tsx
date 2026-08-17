"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteSearch } from "@/components/SiteSearch";
import { signOutCommercial } from "@/lib/commercial/auth-actions";

export type ShopHeaderClientProps = {
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  signedIn: boolean;
  isCustomer: boolean;
  isStaff: boolean;
  cartCount: number;
  roleChip: string | null;
  searchDefault?: string;
};

function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/logo-color.svg"
      alt="Sure Rain"
      className={className ?? "h-8 w-auto"}
    />
  );
}

function AvatarInitial({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sr-green text-sm font-bold text-white"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function AvatarMark({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return <AvatarInitial name={name} />;
}

export function ShopHeaderClient({
  displayName,
  avatarUrl,
  email,
  signedIn,
  isCustomer,
  isStaff,
  cartCount,
  roleChip,
  searchDefault = "",
}: ShopHeaderClientProps) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 28);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const hello = displayName ?? "ahí";

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-[#f7f5f0]/92 backdrop-blur-md">
      <div className="container-sr">
        <div
          className={`flex items-center justify-between gap-3 overflow-hidden transition-[max-height,opacity,padding] duration-200 lg:max-h-16 lg:opacity-100 lg:py-3 ${
            compact ? "max-h-0 py-0 opacity-0 lg:py-3" : "max-h-16 py-3"
          }`}
        >
          <Link href="/" className="flex min-h-11 items-center" aria-label="Sure Rain — inicio">
            <LogoMark className="h-7 w-auto sm:h-8" />
          </Link>

          <div className="hidden min-w-0 flex-1 px-8 lg:block">
            <SiteSearch defaultValue={searchDefault} />
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {signedIn ? (
              <>
                {isStaff ? (
                  <Link
                    href="/gestion/pedidos"
                    className="hidden min-h-11 items-center rounded-md px-3 text-sm font-semibold text-sr-ink/80 hover:bg-sr-mist hover:text-sr-green lg:inline-flex"
                  >
                    Gestión
                  </Link>
                ) : null}
                {isCustomer ? (
                  <Link
                    href="/carrito"
                    className="relative hidden min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm font-semibold text-sr-ink/80 hover:bg-sr-mist hover:text-sr-green lg:inline-flex"
                    aria-label={`Carrito${cartCount ? `, ${cartCount} ítems` : ""}`}
                  >
                    Pedido
                    {cartCount > 0 ? (
                      <span className="ml-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-sr-green px-1.5 text-[11px] font-bold text-white">
                        {cartCount}
                      </span>
                    ) : null}
                  </Link>
                ) : null}
                <Link
                  href="/cuenta"
                  className="flex min-h-11 items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-sr-mist"
                >
                  <AvatarMark name={hello} url={avatarUrl} />
                  <span className="hidden max-w-[10rem] truncate text-sm font-semibold text-sr-ink lg:inline">
                    Hola, {hello}
                  </span>
                </Link>
                <form action={signOutCommercial} className="hidden lg:block">
                  <button
                    type="submit"
                    className="min-h-11 rounded-md px-3 text-sm font-semibold text-sr-ink/55 hover:bg-sr-mist hover:text-sr-green"
                  >
                    Salir
                  </button>
                </form>
              </>
            ) : (
              <Link href="/login" className="btn-primary !min-h-11 !px-4 !py-2 text-sm">
                Ingresar
              </Link>
            )}
          </div>
        </div>

        <div className={`pb-3 lg:hidden ${compact ? "pt-3" : "pt-0"}`}>
          <SiteSearch defaultValue={searchDefault} compact />
        </div>

        {signedIn && roleChip ? (
          <p className="sr-only">
            Sesión de {email} · {roleChip}
          </p>
        ) : null}
      </div>
    </header>
  );
}
