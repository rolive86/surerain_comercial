import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateRepAction } from "@/lib/commercial/crm-actions";
import {
  canManageReps,
  getCrmRep,
} from "@/lib/commercial/crm";
import { getCommercialSession } from "@/lib/commercial/session";
import { requireStaffSession } from "@/lib/commercial/backoffice";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const data = await getCrmRep(id);
    return { title: data ? `${data.rep.name} · Vendedores` : "Vendedor" };
  } catch {
    return { title: "Vendedor" };
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR");
}

const okMsg: Record<string, string> = {
  created: "Vendedor creado.",
  updated: "Datos guardados.",
};

export default async function VendedorDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const flash = await searchParams;
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  const manager = canManageReps(staff);
  const canEdit = manager || staff.claims.sales_rep_id === id;

  const data = await getCrmRep(id);
  if (!data) notFound();
  const { rep, customers } = data;

  return (
    <div>
      <nav className="mb-4 text-sm text-sr-ink/50">
        <Link href="/gestion/vendedores" className="hover:text-sr-green">
          Vendedores
        </Link>
        <span className="mx-2">/</span>
        <span>{rep.name}</span>
      </nav>

      {flash.error ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {flash.error}
        </p>
      ) : null}
      {flash.ok ? (
        <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {okMsg[flash.ok] ?? "Listo."}
        </p>
      ) : null}

      <h1 className="font-display text-3xl font-bold text-sr-ink">{rep.name}</h1>
      <p className="mt-1 text-sm text-sr-ink/55">
        {rep.customer_count} cliente(s) en cartera ·{" "}
        {rep.active ? "activo" : "inactivo"}
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-black/5 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Datos</h2>
          {canEdit ? (
            <form action={updateRepAction} className="mt-3 space-y-3">
              <input type="hidden" name="rep_id" value={rep.id} />
              <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
                Nombre *
                <input
                  name="name"
                  required
                  defaultValue={rep.name}
                  className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={rep.email ?? ""}
                  className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
                />
              </label>
              {manager ? (
                <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
                  Estado
                  <select
                    name="active"
                    defaultValue={rep.active ? "true" : "false"}
                    className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </label>
              ) : (
                <input type="hidden" name="active" value={rep.active ? "true" : "false"} />
              )}
              <button type="submit" className="btn-primary">
                Guardar
              </button>
            </form>
          ) : (
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-sr-ink/45">Email</dt>
                <dd>{rep.email ?? "—"}</dd>
              </div>
            </dl>
          )}
        </section>

        <section className="rounded-xl border border-black/5 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Cartera activa</h2>
          <ul className="mt-3 divide-y divide-black/5">
            {customers.length === 0 ? (
              <li className="py-2 text-sm text-sr-ink/45">Sin clientes asignados.</li>
            ) : (
              customers.map((c) => (
                <li key={c.customer_id} className="flex justify-between gap-3 py-2 text-sm">
                  <Link
                    href={`/gestion/clientes/${c.customer_id}`}
                    className="font-medium hover:text-sr-green"
                  >
                    {c.legal_name}
                  </Link>
                  <span className="text-xs text-sr-ink/40">
                    desde {formatDate(c.valid_from)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
