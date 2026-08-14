"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

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
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  const pushParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
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

  const onSearchChange = (value: string) => {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => update("q", value.trim()), 300);
  };

  const clear = () => {
    setQ("");
    startTransition(() => router.push(pathname));
  };

  const hasFilters = ["q", "categoria", "marca", "mercado", "tipo"].some((k) =>
    searchParams.get(k),
  );

  return (
    <section className="surface p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <label
            htmlFor="catalog-search"
            className="mb-1 block text-xs font-semibold uppercase tracking-wider text-sr-ink/45"
          >
            Buscar producto
          </label>
          <input
            id="catalog-search"
            type="search"
            value={q}
            placeholder="Ej: VYR-26, aspersor, K-Rain…"
            className="w-full min-w-[240px] rounded-md border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-sr-green/30 focus:ring-2 sm:min-w-[320px]"
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <p className="text-sm text-sr-ink/55">
          <span className="font-semibold text-sr-green">{total}</span> productos
          {pending ? " · actualizando…" : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
      </div>

      {hasFilters ? (
        <div className="mt-4">
          <button type="button" onClick={clear} className="btn-secondary text-xs">
            Limpiar filtros
          </button>
        </div>
      ) : null}
    </section>
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
        className="w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-sr-green/30 focus:ring-2"
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
