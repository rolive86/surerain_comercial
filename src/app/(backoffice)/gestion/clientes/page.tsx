import type { Metadata } from "next";
import Link from "next/link";
import { assignSalesRepAction } from "@/lib/commercial/crm-actions";
import {
  canManageAssignments,
  countCustomersWithoutActiveRep,
  listCrmCustomers,
  type CrmCustomerListFilter,
} from "@/lib/commercial/crm";
import { getCommercialSession } from "@/lib/commercial/session";
import { listFilterOptions, requireStaffSession } from "@/lib/commercial/backoffice";

export const metadata: Metadata = {
  title: "Clientes · Gestión",
};

export default async function GestionClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  const params = await searchParams;
  const filtro: CrmCustomerListFilter =
    params.filtro === "sin_vendedor_activo" ? "sin_vendedor_activo" : "all";
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  const manager = canManageAssignments(staff);

  const [customers, sinActivoCount, options] = await Promise.all([
    listCrmCustomers(params.q, filtro),
    countCustomersWithoutActiveRep(),
    manager ? listFilterOptions() : Promise.resolve(null),
  ]);

  const qs = (next: CrmCustomerListFilter) => {
    const p = new URLSearchParams();
    if (params.q) p.set("q", params.q);
    if (next === "sin_vendedor_activo") p.set("filtro", "sin_vendedor_activo");
    const s = p.toString();
    return s ? `/gestion/clientes?${s}` : "/gestion/clientes";
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-sr-ink sm:text-3xl">Clientes</h1>
          <p className="mt-1 text-sm text-sr-ink/55">
            ABM y asignaciones. Alcance según RLS del vendedor.
          </p>
        </div>
        <Link href="/gestion/clientes/nuevo" className="btn-primary w-full sm:w-auto">
          Nuevo cliente
        </Link>
      </div>

      <div className="-mx-1 mt-6 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible">
        <Link
          href={qs("all")}
          className={
            filtro === "all"
              ? "chip min-h-11 shrink-0 bg-sr-green px-3 text-white"
              : "chip min-h-11 shrink-0 bg-white px-3 text-sr-ink/70"
          }
        >
          Todos
        </Link>
        <Link
          href={qs("sin_vendedor_activo")}
          className={
            filtro === "sin_vendedor_activo"
              ? "chip min-h-11 shrink-0 bg-amber-600 px-3 text-white"
              : "chip min-h-11 shrink-0 bg-white px-3 text-sr-ink/70"
          }
        >
          Sin vendedor activo
          {sinActivoCount > 0 ? (
            <span className="ml-1.5 rounded-full bg-black/15 px-1.5 text-xs">
              {sinActivoCount}
            </span>
          ) : null}
        </Link>
      </div>

      <form className="mt-4 flex flex-col gap-2 rounded-xl border border-black/5 bg-white p-4 sm:flex-row sm:flex-wrap">
        {filtro === "sin_vendedor_activo" ? (
          <input type="hidden" name="filtro" value="sin_vendedor_activo" />
        ) : null}
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Buscar razón social, fantasia, CUIT…"
          className="min-h-11 min-w-0 flex-1 rounded-md border border-black/10 px-3 py-2 text-sm sm:min-w-[16rem]"
        />
        <button type="submit" className="btn-secondary w-full sm:w-auto">
          Buscar
        </button>
      </form>

      {filtro === "sin_vendedor_activo" ? (
        <p className="mt-3 text-sm text-amber-800/80">
          Clientes con asignación vigente a un vendedor inactivo. Reasigná a mano a
          un vendedor activo (no hay reasignación automática).
        </p>
      ) : null}

      {customers.length === 0 ? (
        <div className="mt-4 rounded-xl border border-black/5 bg-white px-4 py-8 text-center text-sm text-sr-ink/45">
          {filtro === "sin_vendedor_activo"
            ? "Ningún cliente con vendedor inactivo."
            : "Sin clientes en alcance."}
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-3 md:hidden">
            {customers.map((c) => (
              <li key={c.id} className="rounded-xl border border-black/5 bg-white p-4">
                <Link
                  href={`/gestion/clientes/${c.id}`}
                  className="font-display text-base font-semibold text-sr-ink"
                >
                  {c.trade_name || c.legal_name}
                </Link>
                {c.trade_name ? (
                  <p className="mt-0.5 text-xs text-sr-ink/45">{c.legal_name}</p>
                ) : null}
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-sr-ink/45">CUIT</dt>
                    <dd className="font-mono text-xs text-sr-ink/60">{c.cuit ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-sr-ink/45">Vendedor</dt>
                    <dd className="text-right text-sr-ink/70">
                      {c.active_rep_name ? (
                        <>
                          {c.active_rep_name}
                          {c.active_rep_is_active === false ? (
                            <span className="ml-1 text-xs font-semibold text-amber-700">
                              inactivo
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "Sin asignar"
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-sr-ink/45">Estado</dt>
                    <dd>
                      <span className="chip">{c.active ? "Activo" : "Inactivo"}</span>
                    </dd>
                  </div>
                </dl>
                {manager && filtro === "sin_vendedor_activo" && options ? (
                  <form
                    action={assignSalesRepAction}
                    className="mt-3 flex flex-col gap-2 border-t border-black/5 pt-3"
                  >
                    <input type="hidden" name="customer_id" value={c.id} />
                    <input
                      type="hidden"
                      name="return_to"
                      value="/gestion/clientes?filtro=sin_vendedor_activo&ok=assign"
                    />
                    <select
                      name="sales_rep_id"
                      required
                      className="min-h-11 w-full rounded-md border border-black/10 px-2 py-1.5 text-sm"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Vendedor activo…
                      </option>
                      {options.salesReps.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="btn-secondary w-full">
                      Asignar
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="mt-4 hidden overflow-x-auto rounded-xl border border-black/5 bg-white md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-black/5 text-xs uppercase tracking-wider text-sr-ink/45">
                <tr>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">CUIT</th>
                  <th className="px-4 py-3 font-semibold">Vendedor</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  {manager && filtro === "sin_vendedor_activo" ? (
                    <th className="px-4 py-3 font-semibold">Reasignar</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {customers.map((c) => (
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
                      {c.active_rep_name ? (
                        <>
                          {c.active_rep_name}
                          {c.active_rep_is_active === false ? (
                            <span className="ml-2 text-xs font-semibold text-amber-700">
                              inactivo
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "Sin asignar"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="chip">{c.active ? "Activo" : "Inactivo"}</span>
                    </td>
                    {manager && filtro === "sin_vendedor_activo" && options ? (
                      <td className="px-4 py-3">
                        <form
                          action={assignSalesRepAction}
                          className="flex min-w-[14rem] flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="customer_id" value={c.id} />
                          <input
                            type="hidden"
                            name="return_to"
                            value="/gestion/clientes?filtro=sin_vendedor_activo&ok=assign"
                          />
                          <select
                            name="sales_rep_id"
                            required
                            className="min-w-[10rem] flex-1 rounded-md border border-black/10 px-2 py-1.5 text-sm"
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Vendedor activo…
                            </option>
                            {options.salesReps.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="btn-secondary !min-h-9 !px-3 text-xs">
                            Asignar
                          </button>
                        </form>
                      </td>
                    ) : null}
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
