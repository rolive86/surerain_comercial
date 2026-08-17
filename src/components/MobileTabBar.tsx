"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  match: (path: string) => boolean;
  icon: React.ReactNode;
};

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCatalog() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconCart() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h2l1.2 9.2A2 2 0 0 0 9.18 17H17a2 2 0 0 0 2-1.6L20 8H7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="20" r="1.2" fill="currentColor" />
      <circle cx="16.5" cy="20" r="1.2" fill="currentColor" />
    </svg>
  );
}

function IconOrders() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4h10a2 2 0 0 1 2 2v14l-4-2-3 2-3-2-4 2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 9h6M9 13h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconAccount() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 19.2c.8-3.3 3.5-5.2 7-5.2s6.2 1.9 7 5.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MobileTabBarNav({ cartCount }: { cartCount: number }) {
  const pathname = usePathname();
  const tabs: Tab[] = [
    { href: "/", label: "Inicio", match: (p) => p === "/", icon: <IconHome /> },
    {
      href: "/catalogo",
      label: "Catálogo",
      match: (p) => p.startsWith("/catalogo"),
      icon: <IconCatalog />,
    },
    {
      href: "/carrito",
      label: "Carrito",
      match: (p) => p.startsWith("/carrito"),
      icon: <IconCart />,
    },
    {
      href: "/mis-pedidos",
      label: "Mis compras",
      match: (p) => p.startsWith("/mis-pedidos") || p.startsWith("/pedido"),
      icon: <IconOrders />,
    },
    {
      href: "/cuenta",
      label: "Cuenta",
      match: (p) => p.startsWith("/cuenta"),
      icon: <IconAccount />,
    },
  ];

  return (
    <nav
      aria-label="Navegación principal"
      data-testid="shop-tab-bar"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-black/5 bg-[#f7f5f0]/95 backdrop-blur-md tab-bar-safe lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`relative flex min-h-11 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold tracking-wide ${
                  active ? "text-sr-green" : "text-sr-ink/50"
                }`}
              >
                <span className="relative">
                  {tab.icon}
                  {tab.href === "/carrito" && cartCount > 0 ? (
                    <span className="absolute -right-2.5 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sr-green px-1 text-[10px] font-bold text-white">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  ) : null}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
