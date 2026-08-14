"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addToCartAction } from "@/lib/commercial/cart-actions";

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
}: {
  productSourceId: string;
  productName: string;
  productSlug: string;
  authenticated: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setMessage(null);
    setError(null);

    if (!authenticated) {
      const items = readGuestCart();
      const idx = items.findIndex((i) => i.product_source_id === productSourceId);
      if (idx >= 0) items[idx].quantity += 1;
      else {
        items.push({
          product_source_id: productSourceId,
          product_name_snapshot: productName,
          product_slug_snapshot: productSlug,
          quantity: 1,
        });
      }
      writeGuestCart(items);
      setMessage("Guardado. Ingresá para sincronizar el carrito.");
      return;
    }

    startTransition(async () => {
      const result = await addToCartAction({
        product_source_id: productSourceId,
        product_name_snapshot: productName,
        product_slug_snapshot: productSlug,
        quantity: 1,
      });
      if (!result.ok) {
        if (result.error.includes("ingresar")) {
          router.push(`/login?next=/catalogo/${productSlug}`);
          return;
        }
        setError(result.error);
        return;
      }
      setMessage("Agregado al carrito");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="btn-primary disabled:opacity-60"
      >
        {pending ? "Agregando…" : "Agregar al carrito"}
      </button>
      {message ? <p className="text-sm text-sr-green">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {!authenticated ? (
        <p className="text-xs text-sr-ink/50">
          Sin sesión se guarda localmente y se fusiona al ingresar.
        </p>
      ) : null}
    </div>
  );
}
