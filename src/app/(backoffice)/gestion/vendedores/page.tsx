import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Vendedores · Gestión",
};

export default function GestionVendedoresPage() {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-8">
      <h1 className="font-display text-3xl font-bold text-sr-ink">Vendedores</h1>
      <p className="mt-2 max-w-xl text-sm text-sr-ink/60">
        ABM de vendedores y asignaciones llega en <strong>Fase F</strong>. El filtro por vendedor ya
        está disponible en pedidos.
      </p>
      <Link href="/gestion/pedidos" className="btn-primary mt-6 inline-flex">
        Ir a pedidos
      </Link>
    </div>
  );
}
