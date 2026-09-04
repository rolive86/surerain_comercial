"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export type StockListRow = {
  cod_articulo: string;
  descripcion: string | null;
  familia: string | null;
  image_url: string | null;
  /** Raw Tango qty from products_tango (null = sin dato de stock). */
  stock_qty: number | null;
  /** From stock_availability_many; omit/null when unavailable. */
  stock_real?: number | null;
  comprometido?: number | null;
  libre?: number | null;
  /** True when availability RPC failed for this render (do not show 0). */
  availabilityError?: boolean;
};

export function StockFilters({
  familias,
  q,
  familia,
}: {
  familias: Array<{ slug: string; name: string }>;
  q: string;
  familia: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function push(next: { q?: string; familia?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const qVal = next.q ?? params.get("q") ?? "";
    const famVal = next.familia ?? params.get("familia") ?? "";
    if (qVal) params.set("q", qVal);
    else params.delete("q");
    if (famVal && famVal !== "all") params.set("familia", famVal);
    else params.delete("familia");
    startTransition(() => {
      router.replace(`/gestion/stock?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          push({ q: String(fd.get("q") ?? "") });
        }}
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o código"
          className="min-h-11 flex-1 rounded-xl border border-sr-ink/15 bg-white px-3 text-sm outline-none ring-sr-green focus:ring-2"
          autoComplete="off"
        />
        <button
          type="submit"
          className="min-h-11 rounded-xl bg-sr-green px-4 text-sm font-semibold text-white"
          disabled={pending}
        >
          Buscar
        </button>
      </form>
      <label className="block text-[12px] font-semibold text-sr-ink/55">
        Categoría
        <select
          className="mt-1 min-h-11 w-full rounded-xl border border-sr-ink/15 bg-white px-3 text-sm"
          value={familia || "all"}
          onChange={(e) => push({ familia: e.target.value })}
        >
          <option value="all">Todas</option>
          {familias.map((f) => (
            <option key={f.slug} value={f.slug}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function formatQty(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

/** Primary = disponible (libre). Never invent libre in the client. */
function stockDisplay(row: StockListRow): {
  primary: string;
  secondary: string | null;
  warn: boolean;
} {
  if (row.availabilityError) {
    return { primary: "—", secondary: null, warn: false };
  }
  const noTangoQty = row.stock_qty == null;
  const comprometido = row.comprometido ?? 0;
  if (noTangoQty && comprometido === 0) {
    return { primary: "—", secondary: null, warn: false };
  }
  if (row.libre == null || row.stock_real == null) {
    return { primary: "—", secondary: null, warn: false };
  }
  const secondary =
    comprometido > 0
      ? `Stock ${formatQty(row.stock_real)} · Comprometido ${formatQty(comprometido)}`
      : null;
  return {
    primary: formatQty(row.libre),
    secondary,
    warn: row.libre <= 0,
  };
}

export function StockList({ rows }: { rows: StockListRow[] }) {
  if (!rows.length) {
    return (
      <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-sr-ink/50">
        Sin productos para este filtro.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-sr-mist overflow-hidden rounded-2xl border border-sr-mist bg-white">
      {rows.map((row) => {
        const name = row.descripcion?.trim() || row.cod_articulo;
        const { primary, secondary, warn } = stockDisplay(row);
        const hasPhoto = Boolean(row.image_url);
        return (
          <li
            key={row.cod_articulo}
            className={`flex items-center gap-2.5 px-3 ${hasPhoto ? "py-1.5" : "py-1"}`}
          >
            {hasPhoto ? (
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-sr-mist">
                <Image
                  src={row.image_url!}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="36px"
                  unoptimized
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-semibold text-sr-ink">
                {name}
              </p>
              <p className="truncate font-mono text-[10px] text-sr-ink/45">
                {row.cod_articulo}
                {row.familia ? ` · ${row.familia}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p
                className={`font-display text-base font-bold tabular-nums leading-none ${
                  warn ? "text-amber-800" : "text-sr-green"
                }`}
              >
                {primary}
              </p>
              {secondary ? (
                <p className="mt-0.5 max-w-[9.5rem] text-[9px] leading-tight text-sr-ink/45">
                  {secondary}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
