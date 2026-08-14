"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { mergeGuestCartAction } from "@/lib/commercial/cart-actions";
import { clearGuestCart, getGuestCartItems } from "@/components/AddToCartButton";

/** Merges localStorage guest cart into DB cart once after login. */
export function GuestCartMerger({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (!enabled || ran.current) return;
    const items = getGuestCartItems();
    if (!items.length) return;
    ran.current = true;
    void (async () => {
      const result = await mergeGuestCartAction(items);
      if (result.ok) {
        clearGuestCart();
        router.refresh();
      }
    })();
  }, [enabled, router]);

  return null;
}
