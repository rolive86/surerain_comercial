import Link from "next/link";
import { redirect } from "next/navigation";
import {
  GestionBottomNav,
  VENDEDOR_TAB_ICONS,
} from "@/components/GestionBottomNav";
import {
  GESTION_NAV_ICONS,
  GestionSidebarNav,
} from "@/components/GestionSidebarNav";
import { signOutCommercial } from "@/lib/commercial/auth-actions";
import { canViewModule, getModuleViewFlags } from "@/lib/commercial/modules";
import {
  homePathForRole,
  isAdminConsoleRole,
  isStaffRole,
  isVendedorPwaRole,
} from "@/lib/commercial/roles";
import { getCommercialSession, roleLabel } from "@/lib/commercial/session";

type NavDef = {
  href: string;
  label: keyof typeof GESTION_NAV_ICONS;
  module: "gestion_pedidos" | "gestion_clientes" | "gestion_vendedores" | "admin_console" | null;
  adminOnly?: boolean;
  /** BI comercial: sales_manager / operations / admin */
  comercialBi?: boolean;
};

const STAFF_NAV: NavDef[] = [
  {
    href: "/gestion/dashboard",
    label: "Dashboard",
    module: null,
    adminOnly: true,
  },
  {
    href: "/gestion/comercial",
    label: "Comercial",
    module: null,
    comercialBi: true,
  },
  { href: "/gestion/pedidos", label: "Pedidos", module: "gestion_pedidos" },
  {
    href: "/gestion/inteligencia",
    label: "Inteligencia",
    module: "gestion_clientes",
  },
  {
    href: "/gestion/explorador",
    label: "Explorador",
    module: "gestion_clientes",
  },
  { href: "/gestion/clientes", label: "Clientes", module: "gestion_clientes" },
  {
    href: "/gestion/vendedores",
    label: "Vendedores",
    module: "gestion_vendedores",
  },
  { href: "/gestion/admin", label: "Admin", module: "admin_console" },
];

const VENDEDOR_NAV: NavDef[] = [
  { href: "/gestion", label: "Home", module: null },
  { href: "/gestion/stock", label: "Stock", module: null },
  { href: "/gestion/pulseada", label: "Pulseada", module: null },
  { href: "/gestion/rendicion", label: "Rendición", module: null },
];

export default async function BackofficeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getCommercialSession();
  if (!session) redirect("/login?next=/gestion");
  if (!isStaffRole(session.claims.app_role)) {
    redirect("/");
  }

  const role = session.claims.app_role;
  const flags = await getModuleViewFlags(role);
  const vendedorPwa = isVendedorPwaRole(role);

  const nav = vendedorPwa
    ? VENDEDOR_NAV
    : STAFF_NAV.filter((item) => {
        if (item.adminOnly) return role === "admin";
        if (item.comercialBi) {
          return (
            role === "admin" ||
            role === "sales_manager" ||
            role === "operations"
          );
        }
        if (item.module === "admin_console" && !isAdminConsoleRole(role)) {
          return false;
        }
        if (!item.module) return false;
        return canViewModule(flags, item.module, role);
      });

  const sidebarItems = nav.map((item) => ({
    href: item.href,
    label: item.label,
    icon: GESTION_NAV_ICONS[item.label],
  }));
  const bottomItems = nav.map(({ href, label }) => ({
    href,
    label,
    icon: vendedorPwa ? VENDEDOR_TAB_ICONS[label] : undefined,
  }));
  const homeHref = homePathForRole(role);

  return (
    <div className="flex min-h-screen bg-sr-sand text-sr-ink text-sm">
      <aside className="sticky top-0 hidden h-screen w-[230px] shrink-0 flex-col bg-sr-ink px-4 py-6 lg:flex">
        <Link href={homeHref} className="mb-[26px] flex items-center gap-2.5 px-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sr-green-light to-sr-green-dark text-[15px] font-bold text-white">
            SR
          </div>
          <div>
            <div className="font-display text-base font-bold leading-[1.15] text-white">
              Sure Rain
            </div>
            <div className="text-[10.5px] font-semibold tracking-[0.08em] text-sr-green-light">
              {vendedorPwa ? "VENDEDOR" : "COMERCIAL"}
            </div>
          </div>
        </Link>

        <GestionSidebarNav items={sidebarItems} />

        <div className="mt-auto px-2">
          <div className="flex flex-col gap-2 border-t border-[#232f28] pt-4">
            {!vendedorPwa ? (
              <Link
                href="/catalogo"
                className="text-[11.5px] font-semibold text-sr-green-light hover:underline"
              >
                ← Volver al catálogo
              </Link>
            ) : (
              <Link
                href="/gestion/pedidos"
                className="text-[11.5px] font-semibold text-sr-green-light hover:underline"
              >
                Pedidos y clientes →
              </Link>
            )}
            <div className="break-all text-[11.5px] text-[#8f9993]">
              {session.user.email}
            </div>
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-[#232f28] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                {roleLabel(role)}
              </span>
              <form action={signOutCommercial}>
                <button
                  type="submit"
                  className="text-[11.5px] text-[#8f9993] hover:text-white"
                >
                  Salir
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between gap-2 border-b border-black/10 bg-sr-ink px-3 text-white lg:hidden">
          <Link
            href={homeHref}
            className="inline-flex min-h-11 items-center font-display text-base font-bold"
          >
            Sure Rain{" "}
            <span className="ml-1 font-sans text-[10px] font-medium uppercase tracking-[0.16em] text-sr-green-light">
              {vendedorPwa ? "Vendedor" : "Comercial"}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {!vendedorPwa ? (
              <Link
                href="/catalogo"
                className="inline-flex min-h-11 items-center px-2 text-[12px] text-white/70"
              >
                Catálogo
              </Link>
            ) : null}
            <form action={signOutCommercial}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center px-2 text-[12px] text-white/70"
              >
                Salir
              </button>
            </form>
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl flex-1 overflow-x-hidden px-3 pb-24 pt-6 sm:px-6 sm:pt-8 lg:max-w-none lg:px-8 lg:pb-8">
          {children}
        </div>
        <GestionBottomNav items={bottomItems} />
      </div>
    </div>
  );
}
