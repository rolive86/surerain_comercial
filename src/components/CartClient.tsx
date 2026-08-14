"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  confirmCartAction,
  removeCartItemAction,
  updateCartQtyAction,
} from "@/lib/commercial/cart-actions";
import type { CartView } from "@/lib/commercial/cart";

export function CartClient({
  cart,
  error,
}: {
  cart: CartView;
  error?: string | null;
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
          Agregá productos desde el catálogo. No hay precios en esta etapa.
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

      <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white">
        {cart.items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <a
                href={
                  item.product_slug_snapshot
                    ? `/catalogo/${item.product_slug_snapshot}`
                    : "/catalogo"
                }
                className="font-display text-lg font-semibold text-sr-ink hover:text-sr-green"
              >
                {item.product_name_snapshot}
              </a>
              <p className="mt-1 font-mono text-xs text-sr-ink/45">{item.product_source_id}</p>
            </div>
            <div className="flex items-center gap-3">
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
        ))}
      </ul>

      <form action={confirmCartAction} className="surface space-y-4 p-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-sr-ink">Confirmar pedido</h2>
          <p className="mt-1 text-sm text-sr-ink/55">
            Se crea un pedido en estado <strong>Enviado</strong> con snapshot de productos. Sin
            pago online.
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
