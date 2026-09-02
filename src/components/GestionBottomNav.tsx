"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type GestionNavItem = {
  href: string;
  label: string;
  icon?: ReactNode;
};

const iconClass = "h-5 w-5 shrink-0";

export const VENDEDOR_TAB_ICONS: Record<string, ReactNode> = {
  Home: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  ),
  Stock: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16v12H4z" />
      <path d="M8 7V5h8v2" />
      <path d="M8 12h8" />
    </svg>
  ),
  Pulseada: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </svg>
  ),
  Facturas: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M15 3v4h4" />
      <path d="M10 12h6M10 16h6" />
    </svg>
  ),
};

/** Tab bar inferior solo en mobile/tablet; desktop usa el nav del sidebar. */
export function GestionBottomNav({ items }: { items: GestionNavItem[] }) {
  const pathname = usePathname();
  const tabs = items.filter((i) => !i.href.startsWith("/gestion/admin")).slice(0, 5);

  return (
    <nav
      aria-label="Navegación gestión"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-sr-ink/95 text-white backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-7xl items-stretch">
        {tabs.map((item) => {
          const active =
            item.href === "/gestion"
              ? pathname === "/gestion"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const icon = item.icon ?? VENDEDOR_TAB_ICONS[item.label];
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-center text-[11px] font-semibold leading-tight transition ${
                  active ? "bg-white/10 text-white" : "text-white/65 hover:text-white"
                }`}
              >
                {icon}
                <span className="max-w-[4.5rem] truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
