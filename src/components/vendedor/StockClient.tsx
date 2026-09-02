"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export type StockListRow = {
  cod_articulo: string;
  descripcion: string | null;
  familia: string | null;
  image_url: string | null;
  stock_qty: number | null;
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
        const qty = row.stock_qty;
        return (
          <li key={row.cod_articulo} className="flex items-center gap-3 px-3 py-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-sr-mist">
              {row.image_url ? (
                <Image
                  src={row.image_url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="56px"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-sr-ink/35">
                  Sin foto
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-sr-ink">{name}</p>
              <p className="truncate font-mono text-[11px] text-sr-ink/50">
                {row.cod_articulo}
              </p>
              {row.familia ? (
                <p className="truncate text-[11px] text-sr-ink/40">{row.familia}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-lg font-bold tabular-nums text-sr-green">
                {qty == null ? "—" : qty.toLocaleString("es-AR")}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-sr-ink/40">
                stock
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
