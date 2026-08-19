import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminConsoleRole } from "@/lib/commercial/roles";
import { getCommercialSession } from "@/lib/commercial/session";
import { getModuleViewFlags, canViewModule } from "@/lib/commercial/modules";

const TABS = [
  { href: "/gestion/admin/margenes", label: "Márgenes" },
  { href: "/gestion/admin/precios", label: "Precios" },
  { href: "/gestion/admin/mapeo", label: "Mapeo" },
  { href: "/gestion/admin/permisos", label: "Permisos" },
  { href: "/gestion/admin/metricas", label: "Métricas" },
];

export default async function AdminConsoleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getCommercialSession();
  if (!session || !isAdminConsoleRole(session.claims.app_role)) {
    redirect("/gestion?error=admin_only");
  }
  const flags = await getModuleViewFlags(session.claims.app_role);
  if (!canViewModule(flags, "admin_console", session.claims.app_role)) {
    redirect("/gestion?error=admin_only");
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sr-green">
          Consola
        </p>
        <h1 className="font-display text-3xl font-bold text-sr-ink">Admin</h1>
        <p className="mt-1 max-w-2xl text-sm text-sr-ink/55">
          Márgenes, precios finales, mapeo catálogo↔Tango y visibilidad de módulos. La RLS no
          cambia con los toggles.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/gestion/clientes" className="text-sr-green hover:underline">
            Clientes
          </Link>
          {" · "}
          <Link href="/gestion/vendedores" className="text-sr-green hover:underline">
            Vendedores
          </Link>
          {" · "}
          <Link href="/gestion/pedidos" className="text-sr-green hover:underline">
            Pedidos
          </Link>
        </p>
      </div>
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-black/10 pb-px">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="inline-flex min-h-11 items-center rounded-t-md px-3 text-sm font-semibold text-sr-ink/60 hover:bg-white hover:text-sr-ink"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
