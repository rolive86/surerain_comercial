"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addToCartAction } from "@/lib/commercial/cart-actions";
import { QuantityStepper } from "@/components/QuantityStepper";

const GUEST_CART_KEY = "sr_guest_cart_v1";

export type GuestCartItem = {
  product_source_id: string;
  product_name_snapshot: string;
  product_slug_snapshot?: string | null;
  quantity: number;
};

function readGuestCart(): GuestCartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GuestCartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeGuestCart(items: GuestCartItem[]) {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
}

export function clearGuestCart() {
  localStorage.removeItem(GUEST_CART_KEY);
}

export function getGuestCartItems(): GuestCartItem[] {
  return readGuestCart();
}

export function AddToCartButton({
  productSourceId,
  productName,
  productSlug,
  authenticated,
  compact = false,
  withStepper = false,
}: {
  productSourceId: string;
  productName: string;
  productSlug: string;
  authenticated: boolean;
  compact?: boolean;
  withStepper?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function add(quantity: number) {
    setMessage(null);
    setError(null);

    if (!authenticated) {
      const items = readGuestCart();
      const idx = items.findIndex((i) => i.product_source_id === productSourceId);
      if (idx >= 0) items[idx].quantity += quantity;
      else {
        items.push({
          product_source_id: productSourceId,
          product_name_snapshot: productName,
          product_slug_snapshot: productSlug,
          quantity,
        });
      }
      writeGuestCart(items);
      setMessage("Guardado. Ingresá para sincronizar el pedido.");
      return;
    }

    startTransition(async () => {
      const result = await addToCartAction({
        product_source_id: productSourceId,
        product_name_snapshot: productName,
        product_slug_snapshot: productSlug,
        quantity,
      });
      if (!result.ok) {
        if (result.error.includes("ingresar")) {
          router.push(`/login?next=/catalogo/${productSlug}`);
          return;
        }
        setError(result.error);
        return;
      }
      setMessage("Agregado a la solicitud");
      router.refresh();
    });
  }

  const btnClass = compact
    ? "btn-primary w-full !min-h-11 !px-3 !py-2 text-xs disabled:opacity-60"
    : "btn-primary disabled:opacity-60";

  const label = pending ? "Agregando…" : "Agregar a la solicitud";

  return (
    <div className="space-y-2">
      {withStepper ? (
        <div className="flex flex-wrap items-center gap-2">
          <QuantityStepper
            value={qty}
            onChange={setQty}
            disabled={pending}
            id={`qty-${productSourceId}`}
          />
          <button
            type="button"
            onClick={() => add(qty)}
            disabled={pending}
            className={btnClass}
          >
            {label}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => add(1)}
          disabled={pending}
          className={btnClass}
        >
          {label}
        </button>
      )}
      {message ? <p className="text-xs text-sr-green">{message}</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
