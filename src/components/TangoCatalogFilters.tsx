"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

type Option = { slug: string; name: string };

type Props = {
  familias: Option[];
  total: number;
};

export function TangoCatalogFilters({ familias, total }: Props) {
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

  const hasFilters = ["q", "familia", "disp"].some((k) => searchParams.get(k));

  const fields = (
    <div className="space-y-3">
      <p className="text-sm text-sr-ink/55">
        <span className="font-semibold text-sr-green">{total}</span> artículos pedibles
        {pending ? " · actualizando…" : ""}
      </p>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-sr-ink/45">
          Buscar
        </span>
        <input
          type="search"
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="Código o descripción"
          className="w-full rounded-lg border border-sr-ink/15 bg-white px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              update("q", (e.target as HTMLInputElement).value);
            }
          }}
          onBlur={(e) => update("q", e.target.value)}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-sr-ink/45">
          Familia
        </span>
        <select
          className="w-full rounded-lg border border-sr-ink/15 bg-white px-3 py-2 text-sm"
          value={searchParams.get("familia") ?? "all"}
          onChange={(e) => update("familia", e.target.value)}
        >
          <option value="all">Todas</option>
          {familias.map((f) => (
            <option key={f.slug} value={f.slug}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-sr-ink/45">
          Disponibilidad
        </span>
        <select
          className="w-full rounded-lg border border-sr-ink/15 bg-white px-3 py-2 text-sm"
          value={searchParams.get("disp") ?? "all"}
          onChange={(e) => update("disp", e.target.value)}
        >
          <option value="all">Todos</option>
          <option value="stock">En stock</option>
          <option value="confirmar">A confirmar (sin precio)</option>
        </select>
      </label>
      {hasFilters ? (
        <button type="button" onClick={clear} className="text-sm text-sr-green underline">
          Limpiar filtros
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="mb-4 lg:hidden">
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Ocultar filtros" : "Filtros"}
        </button>
        {open ? <div className="surface mt-3 p-4">{fields}</div> : null}
      </div>
      <aside className="surface hidden p-4 lg:block">{fields}</aside>
    </>
  );
}
