"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { CustomerStockBadge, StaffStockLine } from "@/components/StockBadges";
import type { StockAvailability } from "@/lib/commercial/stock";

function tangoSlug(codArticulo: string): string {
  return `t/${encodeURIComponent(codArticulo)}`;
}

export type VariantOption = {
  cod_articulo: string;
  variant_label: string | null;
  descripcion: string | null;
  image_url: string | null;
  has_stock: boolean;
  has_price: boolean;
  stock_qty: number | null;
};

export function VariantProductPanel({
  groupName,
  familia,
  slug,
  variants,
  initialCode,
  staffMode,
  stockByCode,
}: {
  groupName: string;
  familia: string | null;
  slug: string;
  variants: VariantOption[];
  initialCode?: string | null;
  staffMode: boolean;
  stockByCode: Record<string, StockAvailability>;
}) {
  const initial =
    variants.find((v) => v.cod_articulo === initialCode)?.cod_articulo ??
    variants[0]?.cod_articulo ??
    "";
  const [selected, setSelected] = useState(initial);

  const current = useMemo(
    () => variants.find((v) => v.cod_articulo === selected) ?? variants[0],
    [variants, selected],
  );

  if (!current) {
    return <p className="text-sm text-sr-ink/50">Sin variantes activas.</p>;
  }

  const stock = stockByCode[current.cod_articulo] ?? null;
  const imageUrl = current.image_url;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-sr-mist">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={current.descripcion || groupName}
            fill
            className="object-contain p-6"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#e8f0ea] via-white to-[#f3f7f4]">
            <span className="font-display text-3xl font-bold text-sr-green/60">
              Sure Rain
            </span>
            <span className="max-w-xs px-4 text-center text-sm text-sr-ink/40">
              {groupName}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-5">
        {familia ? <span className="chip-vertical">{familia}</span> : null}
        <h1 className="font-display text-3xl font-bold text-sr-ink sm:text-4xl">
          {groupName}
        </h1>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
            Medida / variante
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {variants.map((v) => {
              const active = v.cod_articulo === current.cod_articulo;
              return (
                <button
                  key={v.cod_articulo}
                  type="button"
                  onClick={() => setSelected(v.cod_articulo)}
                  className={`min-h-10 rounded-md border px-3 py-1.5 text-left text-sm transition ${
                    active
                      ? "border-sr-green bg-sr-green text-white"
                      : "border-black/10 bg-white text-sr-ink hover:border-sr-green/40"
                  }`}
                  title={v.descripcion ?? v.cod_articulo}
                >
                  <span className="font-medium">
                    {v.variant_label || v.cod_articulo}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="font-mono text-sm text-sr-ink/50">{current.cod_articulo}</p>
        {current.descripcion && current.descripcion !== groupName ? (
          <p className="text-sm text-sr-ink/65">{current.descripcion}</p>
        ) : null}

        {staffMode && stock ? (
          <StaffStockLine
            stockReal={stock.stock_real}
            comprometido={stock.comprometido}
            libre={stock.libre}
          />
        ) : (
          <CustomerStockBadge hasStock={Boolean(current.has_stock)} />
        )}

        {!staffMode ? (
          <p className="text-sm text-sr-ink/60">
            El precio se confirma en la cotización que te envía tu vendedor (PDF).
          </p>
        ) : null}

        {!staffMode ? (
          <AddToCartButton
            productSourceId={current.cod_articulo}
            productName={current.descripcion || groupName}
            productSlug={tangoSlug(current.cod_articulo)}
            authenticated
            withStepper
          />
        ) : (
          <p className="text-sm text-sr-ink/55">
            Código listo para cotización telefónica:{" "}
            <Link
              href={`/gestion/pedidos/nueva?cod=${encodeURIComponent(current.cod_articulo)}`}
              className="font-semibold text-sr-green hover:underline"
            >
              Nueva cotización
            </Link>
          </p>
        )}

        <p className="text-xs text-sr-ink/40">
          Enlace directo a esta medida:{" "}
          <Link
            href={`/catalogo/g/${encodeURIComponent(slug)}?v=${encodeURIComponent(current.cod_articulo)}`}
            className="underline"
          >
            {current.variant_label || current.cod_articulo}
          </Link>
        </p>
      </div>
    </div>
  );
}
