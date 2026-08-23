"use client";

import { useEffect, useState, useTransition } from "react";
import { createTelephoneQuoteAction } from "@/lib/commercial/quote-actions";
import {
  searchTangoProductsAction,
  type TangoProductSearchHit,
} from "@/lib/commercial/tango-product-search";
import { StaffStockLine } from "@/components/StockBadges";

type CustomerOpt = { id: string; label: string };

export function NuevaCotizacionForm({
  customers,
}: {
  customers: CustomerOpt[];
}) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<TangoProductSearchHit[]>([]);
  const [searching, startSearch] = useTransition();
  const [lines, setLines] = useState<
    Array<{
      cod_articulo: string;
      name: string;
      quantity: number;
      stock_real?: number;
      comprometido?: number;
      libre?: number;
    }>
  >([]);

  useEffect(() => {
    const needle = q.trim();
    if (!needle) {
      setHits([]);
      return;
    }
    const handle = setTimeout(() => {
      startSearch(async () => {
        try {
          const rows = await searchTangoProductsAction(needle);
          setHits(rows);
        } catch {
          setHits([]);
        }
      });
    }, 280);
    return () => clearTimeout(handle);
  }, [q]);

  function addLine(p: TangoProductSearchHit) {
    setLines((prev) => {
      const existing = prev.find((l) => l.cod_articulo === p.cod_articulo);
      if (existing) {
        return prev.map((l) =>
          l.cod_articulo === p.cod_articulo
            ? { ...l, quantity: l.quantity + 1 }
            : l,
        );
      }
      return [
        ...prev,
        {
          cod_articulo: p.cod_articulo,
          name: p.descripcion?.trim() || p.cod_articulo,
          quantity: 1,
          stock_real: p.stock_real,
          comprometido: p.comprometido,
          libre: p.libre,
        },
      ];
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-black/5 bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Cliente y artículos</h2>
        <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
          Cliente de tu cartera
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
          Buscar artículo Tango
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Código o descripción"
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
            autoComplete="off"
          />
        </label>
        {!q.trim() ? (
          <p className="mt-3 rounded-lg border border-dashed border-black/10 px-3 py-6 text-center text-sm text-sr-ink/50">
            Escribí para buscar
          </p>
        ) : (
          <ul className="mt-3 max-h-80 divide-y divide-black/5 overflow-auto rounded-lg border border-black/5">
            {searching && hits.length === 0 ? (
              <li className="px-3 py-4 text-sm text-sr-ink/50">Buscando…</li>
            ) : hits.length === 0 ? (
              <li className="px-3 py-4 text-sm text-sr-ink/50">Sin resultados</li>
            ) : (
              hits.map((p) => (
                <li
                  key={p.cod_articulo}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {p.descripcion || p.cod_articulo}
                    </p>
                    <p className="font-mono text-xs text-sr-ink/45">{p.cod_articulo}</p>
                    {p.libre != null ? (
                      <StaffStockLine
                        stockReal={p.stock_real ?? 0}
                        comprometido={p.comprometido ?? 0}
                        libre={p.libre}
                        compact
                      />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn-secondary shrink-0 px-3 py-1 text-xs"
                    onClick={() => addLine(p)}
                  >
                    Agregar
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-black/5 bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Líneas</h2>
        <form action={createTelephoneQuoteAction} className="mt-3 space-y-3">
          <input type="hidden" name="customer_id" value={customerId} />
          {lines.length === 0 ? (
            <p className="text-sm text-sr-ink/55">Agregá artículos desde el buscador.</p>
          ) : (
            <ul className="space-y-2">
              {lines.map((l) => (
                <li key={l.cod_articulo} className="rounded-md border border-black/5 p-3">
                  <input type="hidden" name="cod_articulo" value={l.cod_articulo} />
                  <input type="hidden" name="product_name" value={l.name} />
                  <p className="font-medium">{l.name}</p>
                  <p className="font-mono text-xs text-sr-ink/45">{l.cod_articulo}</p>
                  {l.libre != null ? (
                    <StaffStockLine
                      stockReal={l.stock_real ?? 0}
                      comprometido={l.comprometido ?? 0}
                      libre={l.libre}
                      compact
                    />
                  ) : null}
                  <label className="mt-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
                    Cant.
                    <input
                      name="quantity"
                      type="number"
                      min={1}
                      defaultValue={l.quantity}
                      className="w-20 rounded-md border border-black/10 px-2 py-1 text-sm font-normal normal-case tracking-normal"
                    />
                  </label>
                </li>
              ))}
            </ul>
          )}
          <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
            Nota interna (opcional)
            <textarea
              name="note"
              rows={2}
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
            />
          </label>
          <button
            type="submit"
            className="btn-primary"
            disabled={!customerId || lines.length === 0}
          >
            Guardar cotización
          </button>
        </form>
      </section>
    </div>
  );
}
