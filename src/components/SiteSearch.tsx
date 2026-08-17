export function SiteSearch({
  defaultValue = "",
  compact = false,
}: {
  defaultValue?: string;
  compact?: boolean;
}) {
  return (
    <form action="/catalogo" method="get" className="w-full" role="search">
      <label htmlFor="site-search" className="sr-only">
        Buscar productos
      </label>
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sr-ink/35"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          id="site-search"
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder="Buscar aspersores, válvulas, goteo…"
          className={
            compact
              ? "h-11 w-full rounded-xl border border-black/10 bg-white pl-10 pr-3 text-sm outline-none ring-sr-green/30 placeholder:text-sr-ink/40 focus:ring-2"
              : "h-12 w-full rounded-2xl border border-black/10 bg-white pl-11 pr-4 text-sm outline-none ring-sr-green/30 placeholder:text-sr-ink/40 focus:ring-2"
          }
        />
      </div>
    </form>
  );
}
