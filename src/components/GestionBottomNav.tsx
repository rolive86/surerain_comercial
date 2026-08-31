"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type GestionNavItem = { href: string; label: string };

/** Tab bar inferior solo en mobile/tablet; desktop usa el nav del header. */
export function GestionBottomNav({ items }: { items: GestionNavItem[] }) {
  const pathname = usePathname();
  // Accesos principales del vendedor (sin Admin)
  const tabs = items.filter((i) => !i.href.startsWith("/gestion/admin")).slice(0, 5);

  return (
    <nav
      aria-label="Navegación gestión"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-[#0f1f18]/95 text-white backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-7xl items-stretch">
        {tabs.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-center text-[11px] font-semibold leading-tight transition ${
                  active ? "bg-white/10 text-white" : "text-white/65 hover:text-white"
                }`}
              >
                <span className="max-w-[4.5rem] truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
