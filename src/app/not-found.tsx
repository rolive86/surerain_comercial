import Link from "next/link";
import { ShopFooter, ShopHeader } from "@/components/ShopHeader";

export default function NotFound() {
  return (
    <>
      <ShopHeader />
      <main className="container-sr flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sr-green">404</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-sr-ink">Página no encontrada</h1>
        <p className="mt-2 max-w-md text-sm text-sr-ink/60">
          El enlace no existe o el producto ya no está publicado.
        </p>
        <Link href="/catalogo" className="btn-primary mt-8">
          Volver al catálogo
        </Link>
      </main>
      <ShopFooter />
    </>
  );
}
