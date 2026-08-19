"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  confirmCartAction,
  removeCartItemAction,
  updateCartQtyAction,
} from "@/lib/commercial/cart-actions";
import type { CartView } from "@/lib/commercial/cart";
import {
  displayFinalUsd,
  formatFinalUsd,
  isValidFinalAmount,
  PRICE_TO_CONFIRM,
} from "@/lib/commercial/money";

export function CartClient({
  cart,
  error,
  searchOk,
  searchMissing,
}: {
  cart: CartView;
  error?: string | null;
  searchOk?: string | null;
  searchMissing?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeQty(itemId: string, quantity: number) {
    startTransition(async () => {
      await updateCartQtyAction(itemId, quantity);
      router.refresh();
    });
  }

  function removeItem(itemId: string) {
    startTransition(async () => {
      await removeCartItemAction(itemId);
      router.refresh();
    });
  }

  if (!cart.items.length) {
    return (
      <div className="surface px-6 py-16 text-center">
        <p className="font-display text-xl text-sr-ink/70">Tu carrito está vacío</p>
        <p className="mt-2 text-sm text-sr-ink/45">
          Agregá productos desde el catálogo.
        </p>
        <a href="/catalogo" className="btn-primary mt-6 inline-flex">
          Ir al catálogo
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {searchOk === "reorder" ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Volviste a cargar el pedido.{searchMissing ? ` ${searchMissing} producto(s) ya no están disponibles.` : ""}
        </p>
      ) : null}

      <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white">
        {cart.items.map((item) => {
          const href = item.product_slug_snapshot
            ? `/catalogo/${item.product_slug_snapshot}`
            : "/catalogo";
          return (
            <li
              key={item.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <a
                  href={href}
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-sr-mist"
                >
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.image_alt || item.product_name_snapshot}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-semibold leading-tight text-sr-green/45">
                      {item.product_name_snapshot.slice(0, 18)}
                    </span>
                  )}
                </a>
                <div className="min-w-0">
                  <a
                    href={href}
                    className="font-display text-lg font-semibold text-sr-ink hover:text-sr-green"
                  >
                    {item.product_name_snapshot}
                  </a>
                  {item.tango_code ? (
                    <p className="font-mono text-xs text-sr-ink/50">{item.tango_code}</p>
                  ) : null}
                  <p className="text-sm font-semibold text-sr-green">
                    {displayFinalUsd(item.unit_price)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:pl-0 pl-[4.75rem]">
                <label className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
                  Cant.
                  <input
                    type="number"
                    min={1}
                    step={1}
                    defaultValue={item.quantity}
                    disabled={pending}
                    onBlur={(e) => {
                      const value = Number(e.target.value);
                      if (!Number.isFinite(value) || value === item.quantity) return;
                      changeQty(item.id, value);
                    }}
                    className="ml-2 w-20 rounded-md border border-black/10 px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => removeItem(item.id)}
                  className="text-sm font-semibold text-sr-ink/50 hover:text-red-700"
                >
                  Quitar
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <form action={confirmCartAction} className="surface space-y-4 p-6">
        <CartTotals items={cart.items} />
        <div>
          <h2 className="font-display text-xl font-semibold text-sr-ink">Confirmar pedido</h2>
          <p className="mt-1 text-sm text-sr-ink/55">
            Se crea un pedido en estado <strong>Enviado</strong>. Podés confirmar aunque
            haya ítems a confirmar: el vendedor cierra esos precios después. Sin pago online.
          </p>
        </div>
        <label className="block">
          <span className="text-sm font-semibold text-sr-ink/70">Nota para Sure Rain (opcional)</span>
          <textarea
            name="customer_note"
            rows={3}
            className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-sr-green/30 focus:ring-2"
            placeholder="Observaciones de entrega, referencias, etc."
          />
        </label>
        <button type="submit" className="btn-primary" disabled={pending}>
          Confirmar pedido
        </button>
      </form>
    </div>
  );
}

function CartTotals({
  items,
}: {
  items: CartView["items"];
}) {
  const priced = items.filter((i) => isValidFinalAmount(i.unit_price));
  const pendingCount = items.length - priced.length;
  const subtotal = priced.reduce((sum, i) => sum + Number(i.unit_price) * i.quantity, 0);
  const parts: string[] = [];
  if (priced.length) {
    parts.push(`Subtotal: ${formatFinalUsd(subtotal)} (${priced.length} ítem${priced.length === 1 ? "" : "s"})`);
  }
  if (pendingCount) {
    parts.push(`${pendingCount} ítem${pendingCount === 1 ? "" : "s"} a confirmar`);
  }
  return (
    <p className="rounded-md bg-sr-mist/70 px-3 py-2 text-sm text-sr-ink/75">
      {parts.join(" · ") || PRICE_TO_CONFIRM}
    </p>
  );
}
