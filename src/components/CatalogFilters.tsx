"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

type Option = { slug: string; name: string };

type Props = {
  categories: Option[];
  brands: Option[];
  markets: Option[];
  types: Option[];
  total: number;
};

export function CatalogFilters({
  categories,
  brands,
  markets,
  types,
  total,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const pushParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("page");
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [pathname, router, searchParams],
  );

  const update = (key: string, value: string) => {
    pushParams((params) => {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    });
  };

  const clear = () => {
    startTransition(() => router.push(pathname));
    setOpen(false);
  };

  const hasFilters = ["q", "categoria", "marca", "mercado", "tipo"].some((k) =>
    searchParams.get(k),
  );

  const fields = (
    <div className="space-y-3">
      <p className="text-sm text-sr-ink/55">
        <span className="font-semibold text-sr-green">{total}</span> productos
        {pending ? " · actualizando…" : ""}
      </p>
      <FilterSelect
        label="Categoría"
        value={searchParams.get("categoria") ?? "all"}
        options={categories}
        onChange={(v) => update("categoria", v)}
      />
      <FilterSelect
        label="Marca"
        value={searchParams.get("marca") ?? "all"}
        options={brands}
        onChange={(v) => update("marca", v)}
      />
      <FilterSelect
        label="Mercado"
        value={searchParams.get("mercado") ?? "all"}
        options={markets}
        onChange={(v) => update("mercado", v)}
      />
      <FilterSelect
        label="Tipo"
        value={searchParams.get("tipo") ?? "all"}
        options={types}
        onChange={(v) => update("tipo", v)}
      />
      {hasFilters ? (
        <button type="button" onClick={clear} className="btn-secondary w-full text-xs">
          Limpiar filtros
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
        <p className="text-sm text-sr-ink/55">
          <span className="font-semibold text-sr-green">{total}</span> productos
        </p>
        <button
          type="button"
          className="btn-secondary !min-h-11 !px-4"
          onClick={() => setOpen(true)}
        >
          Filtros
        </button>
      </div>

      <aside className="hidden lg:sticky lg:top-24 lg:block">{fields}</aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar filtros"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-[#f7f5f0] p-5 shadow-card tab-bar-safe">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Filtros</h2>
              <button
                type="button"
                className="min-h-11 min-w-11 rounded-md text-sr-ink/55"
                onClick={() => setOpen(false)}
              >
                Cerrar
              </button>
            </div>
            {fields}
            <button
              type="button"
              className="btn-primary mt-6"
              onClick={() => setOpen(false)}
            >
              Ver resultados
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
        {label}
      </label>
      <select
        className="h-11 w-full rounded-md border border-black/10 bg-white px-3 text-sm outline-none ring-sr-green/30 focus:ring-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="all">Todas</option>
        {options.map((opt) => (
          <option key={opt.slug} value={opt.slug}>
            {opt.name}
          </option>
        ))}
      </select>
    </div>
  );
}
