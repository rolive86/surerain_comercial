import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Portal de pedidos",
  description:
    "Portal de pedidos para clientes Sure Rain. Ingresá, armá tu pedido y un vendedor lo confirma. Sin pago online.",
};

export default function ClientesLandingPage() {
  return (
    <div className="container-sr py-12 sm:py-20">
      <section className="surface overflow-hidden px-6 py-10 sm:px-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sr-green">
          Clientes Sure Rain
        </p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-bold leading-[1.08] text-sr-ink sm:text-5xl">
          Portal de pedidos para clientes Sure Rain
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-sr-ink/65 sm:text-lg">
          Armá tu pedido desde el catálogo técnico. Un vendedor lo confirma del otro lado.
          Sin pago online: la operación comercial sigue el circuito de Sure Rain.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="btn-primary">
            Ingresar a hacer pedidos
          </Link>
          <Link href="/catalogo" className="btn-secondary">
            Ver catálogo público
          </Link>
        </div>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <article className="surface p-5">
          <h2 className="font-display text-lg font-semibold text-sr-ink">1. Ingresá</h2>
          <p className="mt-2 text-sm text-sr-ink/60">
            Accedé con tu usuario de cliente. Tu empresa viene del sistema de Sure Rain.
          </p>
        </article>
        <article className="surface p-5">
          <h2 className="font-display text-lg font-semibold text-sr-ink">2. Armá el pedido</h2>
          <p className="mt-2 text-sm text-sr-ink/60">
            Buscá productos, definí cantidades y confirmá. Los precios se publican cuando
            esté el listado comercial.
          </p>
        </article>
        <article className="surface p-5">
          <h2 className="font-display text-lg font-semibold text-sr-ink">3. Lo confirma tu vendedor</h2>
          <p className="mt-2 text-sm text-sr-ink/60">
            Seguís el estado en Mis compras. La logística se informa cuando esté disponible.
          </p>
        </article>
      </section>
    </div>
  );
}
