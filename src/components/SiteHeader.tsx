import Link from "next/link";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/catalogo", label: "Catálogo" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-[#f7f5f0]/90 backdrop-blur-md">
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
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-semibold text-sr-ink/80 transition hover:bg-sr-mist hover:text-sr-green"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-black/5 bg-white/50">
      <div className="container-sr flex flex-col gap-3 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-lg font-semibold text-sr-green">Sure Rain</p>
        <p className="text-sm text-sr-ink/55">
          Catálogo técnico de riego · datos desde Supabase
        </p>
      </div>
    </footer>
  );
}
