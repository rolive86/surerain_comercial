import Link from "next/link";
import { redirect } from "next/navigation";
import { GestionBottomNav } from "@/components/GestionBottomNav";
import { signOutCommercial } from "@/lib/commercial/auth-actions";
import { canViewModule, getModuleViewFlags } from "@/lib/commercial/modules";
import { isAdminConsoleRole, isStaffRole } from "@/lib/commercial/roles";
import { getCommercialSession, roleLabel } from "@/lib/commercial/session";

const NAV = [
  { href: "/gestion/pedidos", label: "Pedidos", module: "gestion_pedidos" as const },
  { href: "/gestion/inteligencia", label: "Inteligencia", module: "gestion_clientes" as const },
  { href: "/gestion/explorador", label: "Explorador", module: "gestion_clientes" as const },
  { href: "/gestion/clientes", label: "Clientes", module: "gestion_clientes" as const },
  { href: "/gestion/vendedores", label: "Vendedores", module: "gestion_vendedores" as const },
  { href: "/gestion/admin", label: "Admin", module: "admin_console" as const },
];

export default async function BackofficeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getCommercialSession();
  if (!session) redirect("/login?next=/gestion");
  if (!isStaffRole(session.claims.app_role)) {
    redirect("/");
  }
  const flags = await getModuleViewFlags(session.claims.app_role);
  const nav = NAV.filter((item) => {
    if (item.module === "admin_console" && !isAdminConsoleRole(session.claims.app_role)) {
      return false;
    }
    return canViewModule(flags, item.module, session.claims.app_role);
  });
  const navLinks = nav.map(({ href, label }) => ({ href, label }));

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#eef1ef]">
      <header className="sticky top-0 z-40 border-b border-black/10 bg-[#0f1f18] text-white">
        <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-2 px-3 py-1 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 lg:gap-4">
            <Link
              href="/gestion/pedidos"
              className="inline-flex min-h-11 shrink-0 items-center font-display text-base font-bold tracking-tight sm:text-lg"
            >
              Sure Rain{" "}
              <span className="ml-1 font-sans text-[10px] font-medium uppercase tracking-[0.16em] text-white/50 sm:text-xs">
                Gestión
              </span>
            </Link>
            <nav className="hidden items-center gap-1 lg:flex">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex min-w-0 items-center gap-0.5 text-sm sm:gap-1">
            <Link
              href="/catalogo"
              className="inline-flex min-h-11 items-center rounded-md px-2 text-white/70 hover:bg-white/10 hover:text-white sm:px-3"
            >
              <span className="hidden sm:inline">Volver al catálogo</span>
              <span className="sm:hidden">Catálogo</span>
            </Link>
            <span className="hidden max-w-[12rem] truncate px-2 text-white/70 lg:inline">
              {session.user.email}
            </span>
            <span className="hidden rounded bg-white/10 px-2 py-0.5 text-xs md:inline">
              {roleLabel(session.claims.app_role)}
            </span>
            <form action={signOutCommercial}>
              <button
                type="submit"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-white/70 hover:bg-white/10 hover:text-white sm:px-3"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 pb-24 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-8">
        {children}
      </main>
      <GestionBottomNav items={navLinks} />
    </div>
  );
}
