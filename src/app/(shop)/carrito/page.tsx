import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CartClient } from "@/components/CartClient";
import { getOrCreateOpenCart } from "@/lib/commercial/cart";
import { getCommercialSession } from "@/lib/commercial/session";
import { getProductThumbnailsBySourceIds } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Mi solicitud de cotización",
  description: "Solicitud de cotización B2B Sure Rain.",
};

export default async function CarritoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; faltan?: string }>;
}) {
  const session = await getCommercialSession();
  if (!session) redirect("/login?next=/carrito");
  if (session.claims.app_role !== "customer_user") {
    redirect("/cuenta?error=cart_customer_only");
  }

  const params = await searchParams;
  let cart;
  try {
    cart = await getOrCreateOpenCart();
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "No se pudo cargar la solicitud");
  }

  const thumbs = await getProductThumbnailsBySourceIds(
    cart.items.map((item) => item.product_source_id),
  );
  const cartWithImages = {
    ...cart,
    items: cart.items.map((item) => {
      const thumb = thumbs.get(item.product_source_id);
      return {
        ...item,
        image_url: item.image_url ?? thumb?.url ?? null,
        image_alt: item.image_alt ?? thumb?.alt ?? item.product_name_snapshot,
      };
    }),
  };

  return (
    <div className="container-sr py-12">
      <h1 className="font-display text-3xl font-bold text-sr-green">
        Mi solicitud de cotización
      </h1>
      <p className="mt-2 text-sm text-sr-ink/60">{cart.itemCount} artículo(s)</p>
      <div className="mt-8">
        <CartClient
          cart={cartWithImages}
          error={params.error ?? null}
          searchOk={params.ok ?? null}
          searchMissing={params.faltan ?? null}
        />
      </div>
    </div>
  );
}
