import type { Metadata } from "next";
import Link from "next/link";
import { listCrmCustomers } from "@/lib/commercial/crm";

export const metadata: Metadata = {
  title: "Clientes · Gestión",
};

export default async function GestionClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const customers = await listCrmCustomers(params.q);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-sr-ink">Clientes</h1>
          <p className="mt-1 text-sm text-sr-ink/55">
            ABM y asignaciones. Alcance según RLS del vendedor.
          </p>
        </div>
        <Link href="/gestion/clientes/nuevo" className="btn-primary">
          Nuevo cliente
        </Link>
      </div>

      <form className="mt-6 flex flex-wrap gap-2 rounded-xl border border-black/5 bg-white p-4">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Buscar razón social, fantasia, CUIT…"
          className="min-w-[16rem] flex-1 rounded-md border border-black/10 px-3 py-2 text-sm"
        />
        <button type="submit" className="btn-secondary">
          Buscar
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-black/5 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-black/5 text-xs uppercase tracking-wider text-sr-ink/45">
            <tr>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">CUIT</th>
              <th className="px-4 py-3 font-semibold">Vendedor</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sr-ink/45">
                  Sin clientes en alcance.
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="hover:bg-sr-mist/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/gestion/clientes/${c.id}`}
                      className="font-semibold text-sr-ink hover:text-sr-green"
                    >
                      {c.trade_name || c.legal_name}
                    </Link>
                    {c.trade_name ? (
                      <p className="text-xs text-sr-ink/45">{c.legal_name}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-sr-ink/60">
                    {c.cuit ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sr-ink/70">
                    {c.active_rep_name ?? "Sin asignar"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="chip">{c.active ? "Activo" : "Inactivo"}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
