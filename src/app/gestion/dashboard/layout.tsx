import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutCommercial } from "@/lib/commercial/auth-actions";
import { getCommercialSession, roleLabel } from "@/lib/commercial/session";

const NAV = [
  {
    href: "/gestion/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/gestion/pedidos",
    label: "Pedidos",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16v4H4z" />
        <path d="M4 8v12h16V8" />
        <path d="M9 12h6" />
      </svg>
    ),
  },
  {
    href: "/gestion/inteligencia",
    label: "Inteligencia",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    href: "/gestion/explorador",
    label: "Explorador",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
    ),
  },
  {
    href: "/gestion/clientes",
    label: "Clientes",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
      </svg>
    ),
  },
  {
    href: "/gestion/vendedores",
    label: "Vendedores",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 3l5 5-11 11H5v-5z" />
      </svg>
    ),
  },
  {
    href: "/gestion/admin",
    label: "Admin",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2l3 6 6.5 1-4.7 4.6L18 20l-6-3.5L6 20l1.2-6.4L2.5 9l6.5-1z" />
      </svg>
    ),
  },
] as const;

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getCommercialSession();
  if (!session) redirect("/login?next=/gestion/dashboard");

  const role = session.claims.app_role;
  if (role !== "admin") {
    redirect("/gestion?error=admin_only");
  }

  return (
    <div className="flex min-h-screen bg-sr-sand text-sr-ink text-sm">
      <aside className="flex w-[230px] shrink-0 flex-col bg-sr-ink px-4 py-6">
        <div className="mb-[26px] flex items-center gap-2.5 px-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sr-green-light to-sr-green-dark text-[15px] font-bold text-white">
            SR
          </div>
          <div>
            <div className="font-display text-base font-bold leading-[1.15] text-white">
              Sure Rain
            </div>
            <div className="text-[10.5px] font-semibold tracking-[0.08em] text-sr-green-light">
              GESTIÓN
            </div>
          </div>
        </div>

        <nav className="mt-1.5 flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = item.href === "/gestion/dashboard";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                  active
                    ? "bg-sr-green text-white"
                    : "text-[#b9c2bc] hover:bg-[#1c2921] hover:text-white"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-2">
          <div className="flex flex-col gap-2 border-t border-[#232f28] pt-4">
            <Link
              href="/catalogo"
              className="text-[11.5px] font-semibold text-sr-green-light hover:underline"
            >
              ← Volver al catálogo
            </Link>
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

      {children}
    </div>
  );
}
