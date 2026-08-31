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
          <h1 className="font-display text-2xl font-bold text-sr-ink sm:text-3xl">Vendedores</h1>
          <p className="mt-1 text-sm text-sr-ink/55">
            Vendedores activos y cartera. Los inactivos no se listan ni aparecen en
            selectores (sí pueden figurar en historiales).
          </p>
        </div>
        {manager ? (
          <Link href="/gestion/vendedores/nuevo" className="btn-primary w-full sm:w-auto">
            Nuevo vendedor
          </Link>
        ) : null}
      </div>

      <form className="mt-6 flex flex-col gap-2 rounded-xl border border-black/5 bg-white p-4 sm:flex-row sm:flex-wrap">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Buscar nombre o email…"
          className="min-h-11 min-w-0 flex-1 rounded-md border border-black/10 px-3 py-2 text-sm sm:min-w-[16rem]"
        />
        <button type="submit" className="btn-secondary w-full sm:w-auto">
          Buscar
        </button>
      </form>

      {reps.length === 0 ? (
        <div className="mt-4 rounded-xl border border-black/5 bg-white px-4 py-8 text-center text-sm text-sr-ink/45">
          Sin vendedores visibles.
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-3 md:hidden">
            {reps.map((r) => (
              <li key={r.id} className="rounded-xl border border-black/5 bg-white p-4">
                <Link
                  href={`/gestion/vendedores/${r.id}`}
                  className="font-display text-base font-semibold text-sr-ink"
                >
                  {r.name}
                </Link>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-sr-ink/45">Email</dt>
                    <dd className="text-right text-sr-ink/60">{r.email ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-sr-ink/45">Clientes</dt>
                    <dd className="font-medium">{r.customer_count}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-sr-ink/45">Estado</dt>
                    <dd>
                      <span className="chip">{r.active ? "Activo" : "Inactivo"}</span>
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          <div className="mt-4 hidden overflow-x-auto rounded-xl border border-black/5 bg-white md:block">
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
                {reps.map((r) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
