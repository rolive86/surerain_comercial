import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Clientes · Gestión",
};

export default function GestionClientesPage() {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-8">
      <h1 className="font-display text-3xl font-bold text-sr-ink">Clientes</h1>
      <p className="mt-2 max-w-xl text-sm text-sr-ink/60">
        ABM de clientes y asignaciones llega en <strong>Fase F</strong>. Mientras tanto usá el
        panel de pedidos filtrado por cliente.
      </p>
      <Link href="/gestion/pedidos" className="btn-primary mt-6 inline-flex">
        Ir a pedidos
      </Link>
    </div>
  );
}
