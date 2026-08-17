import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutCommercial } from "@/lib/commercial/auth-actions";
import { isStaffRole } from "@/lib/commercial/roles";
import { getCommercialSession, roleLabel } from "@/lib/commercial/session";

const nav = [
  { href: "/gestion/pedidos", label: "Pedidos" },
  { href: "/gestion/clientes", label: "Clientes" },
  { href: "/gestion/vendedores", label: "Vendedores" },
];

export default async function BackofficeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getCommercialSession();
  if (!session) redirect("/login?next=/gestion");
  if (!isStaffRole(session.claims.app_role)) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[#eef1ef]">
      <header className="border-b border-black/10 bg-[#0f1f18] text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/gestion/pedidos" className="font-display text-lg font-bold tracking-tight">
              Sure Rain <span className="font-sans text-xs font-medium uppercase tracking-[0.16em] text-white/50">Gestión</span>
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/catalogo" className="text-white/55 hover:text-white">
              Volver al catálogo
            </Link>
            <span className="hidden text-white/40 sm:inline">|</span>
            <span className="hidden text-white/70 sm:inline">{session.user.email}</span>
            <span className="rounded bg-white/10 px-2 py-0.5 text-xs">
              {roleLabel(session.claims.app_role)}
            </span>
            <form action={signOutCommercial}>
              <button type="submit" className="text-white/60 hover:text-white">
                Salir
              </button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 border-t border-white/10 px-4 py-2 sm:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm text-white/75 hover:bg-white/10"
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
