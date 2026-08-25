import Link from "next/link";
import { redirect } from "next/navigation";
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

  return (
    <div className="min-h-screen bg-[#eef1ef]">
      <header className="sticky top-0 z-40 border-b border-black/10 bg-[#0f1f18] text-white">
        <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 py-1 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 lg:gap-4">
            <Link
              href="/gestion/pedidos"
              className="inline-flex min-h-11 items-center font-display text-lg font-bold tracking-tight"
            >
              Sure Rain{" "}
              <span className="ml-1 font-sans text-xs font-medium uppercase tracking-[0.16em] text-white/50">
                Gestión
              </span>
            </Link>
            <nav className="hidden items-center gap-1 lg:flex">
              {nav.map((item) => (
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
          <div className="flex min-w-0 items-center gap-1 text-sm">
            <Link
              href="/catalogo"
              className="inline-flex min-h-11 items-center rounded-md px-3 text-white/70 hover:bg-white/10 hover:text-white"
            >
              Volver al catálogo
            </Link>
            <span className="hidden max-w-[12rem] truncate px-2 text-white/70 lg:inline">
              {session.user.email}
            </span>
            <span className="hidden rounded bg-white/10 px-2 py-0.5 text-xs sm:inline">
              {roleLabel(session.claims.app_role)}
            </span>
            <form action={signOutCommercial}>
              <button
                type="submit"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-white/70 hover:bg-white/10 hover:text-white"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 border-t border-white/10 px-2 py-1 lg:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md px-2 text-sm text-white/75 hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
