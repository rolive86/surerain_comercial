import type { Metadata } from "next";
import Link from "next/link";
import { canManageReps, listCrmReps } from "@/lib/commercial/crm";
import { getCommercialSession } from "@/lib/commercial/session";
import { requireStaffSession } from "@/lib/commercial/backoffice";

export const metadata: Metadata = {
  title: "Vendedores · Gestión",
};

export default async function GestionVendedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  const manager = canManageReps(staff);
  const reps = await listCrmReps(params.q);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-sr-ink">Vendedores</h1>
          <p className="mt-1 text-sm text-sr-ink/55">
            Vendedores activos y cartera. Los inactivos no se listan ni aparecen en
            selectores (sí pueden figurar en historiales).
          </p>
        </div>
        {manager ? (
          <Link href="/gestion/vendedores/nuevo" className="btn-primary">
            Nuevo vendedor
          </Link>
        ) : null}
      </div>

      <form className="mt-6 flex flex-wrap gap-2 rounded-xl border border-black/5 bg-white p-4">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Buscar nombre o email…"
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
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Clientes</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {reps.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sr-ink/45">
                  Sin vendedores visibles.
                </td>
              </tr>
            ) : (
              reps.map((r) => (
                <tr key={r.id} className="hover:bg-sr-mist/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/gestion/vendedores/${r.id}`}
                      className="font-semibold text-sr-ink hover:text-sr-green"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sr-ink/60">{r.email ?? "—"}</td>
                  <td className="px-4 py-3">{r.customer_count}</td>
                  <td className="px-4 py-3">
                    <span className="chip">{r.active ? "Activo" : "Inactivo"}</span>
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
