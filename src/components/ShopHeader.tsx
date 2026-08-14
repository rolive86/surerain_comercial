import Link from "next/link";
import { GuestCartMerger } from "@/components/GuestCartMerger";
import { getOpenCartOrNull } from "@/lib/commercial/cart";
import { getCommercialSession, roleLabel } from "@/lib/commercial/session";
import { signOutCommercial } from "@/lib/commercial/auth-actions";

const publicLinks = [
  { href: "/", label: "Inicio" },
  { href: "/catalogo", label: "Catálogo" },
];

export async function ShopHeader() {
  const session = await getCommercialSession();
  const isCustomer = session?.claims.app_role === "customer_user";
  const cart = isCustomer ? await getOpenCartOrNull() : null;

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-[#f7f5f0]/90 backdrop-blur-md">
      <GuestCartMerger enabled={Boolean(isCustomer)} />
      <div className="container-sr flex h-16 items-center justify-between gap-4">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-2xl font-bold tracking-tight text-sr-green transition group-hover:text-sr-green-dark">
            Sure Rain
          </span>
          <span className="hidden text-xs font-medium uppercase tracking-[0.18em] text-sr-ink/45 sm:inline">
            Riego
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-semibold text-sr-ink/80 transition hover:bg-sr-mist hover:text-sr-green"
            >
              {link.label}
            </Link>
          ))}

          {session ? (
            <>
              {isCustomer ? (
                <Link
                  href="/carrito"
                  className="rounded-md px-3 py-2 text-sm font-semibold text-sr-ink/80 transition hover:bg-sr-mist hover:text-sr-green"
                >
                  Carrito
                  {cart && cart.itemCount > 0 ? (
                    <span className="ml-1 inline-flex min-w-[1.25rem] justify-center rounded-full bg-sr-green px-1.5 text-[11px] font-bold text-white">
                      {cart.itemCount}
                    </span>
                  ) : null}
                </Link>
              ) : null}
              <Link
                href="/cuenta"
                className="rounded-md px-3 py-2 text-sm font-semibold text-sr-ink/80 transition hover:bg-sr-mist hover:text-sr-green"
              >
                Mi cuenta
              </Link>
              <div className="ml-1 hidden items-center gap-2 rounded-md border border-sr-green/15 bg-white/70 px-2.5 py-1.5 sm:flex">
                <span className="max-w-[10rem] truncate text-xs font-medium text-sr-ink/70">
                  {session.user.email}
                </span>
                <span className="chip">{roleLabel(session.claims.app_role)}</span>
              </div>
              <form action={signOutCommercial}>
                <button
                  type="submit"
                  className="rounded-md px-3 py-2 text-sm font-semibold text-sr-ink/55 transition hover:bg-sr-mist hover:text-sr-green"
                >
                  Salir
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn-primary ml-1 !px-3 !py-2 text-sm">
              Ingresar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function ShopFooter() {
  return (
    <footer className="mt-20 border-t border-black/5 bg-white/50">
      <div className="container-sr flex flex-col gap-3 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-lg font-semibold text-sr-green">Sure Rain</p>
        <p className="text-sm text-sr-ink/55">
          Portal B2B · catálogo público · datos desde Supabase
        </p>
      </div>
    </footer>
  );
}
