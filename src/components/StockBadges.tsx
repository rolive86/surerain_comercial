export function CustomerStockBadge({
  hasStock,
}: {
  hasStock: boolean;
}) {
  return hasStock ? (
    <span className="inline-block rounded bg-sr-green/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sr-green">
      En stock
    </span>
  ) : (
    <span className="inline-block rounded bg-black/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sr-ink/45">
      Sin stock
    </span>
  );
}

export function StaffStockLine({
  stockReal,
  comprometido,
  libre,
  compact = false,
}: {
  stockReal: number;
  comprometido: number;
  libre: number;
  compact?: boolean;
}) {
  const fmt = (n: number) =>
    n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  const warn = libre <= 0;
  const className = warn
    ? compact
      ? "text-[11px] font-medium text-amber-800"
      : "text-xs font-medium text-amber-800"
    : compact
      ? "text-[11px] text-sr-ink/55"
      : "text-xs text-sr-ink/60";

  return (
    <p className={className}>
      Real {fmt(stockReal)} · Cotizado {fmt(comprometido)} · Libre {fmt(libre)}
    </p>
  );
}
