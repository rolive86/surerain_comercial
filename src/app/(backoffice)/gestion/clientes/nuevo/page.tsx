import type { Metadata } from "next";
import Link from "next/link";
import { createCustomerAction } from "@/lib/commercial/crm-actions";
import { canManageAssignments } from "@/lib/commercial/crm";
import { getCommercialSession } from "@/lib/commercial/session";
import { requireStaffSession, listFilterOptions } from "@/lib/commercial/backoffice";

export const metadata: Metadata = {
  title: "Nuevo cliente · Comercial",
};

export default async function NuevoClientePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const flash = await searchParams;
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  const manager = canManageAssignments(staff);
  const options = manager ? await listFilterOptions() : null;

  return (
    <div className="mx-auto max-w-2xl">
      <nav className="mb-4 text-sm text-sr-ink/50">
        <Link href="/gestion/clientes" className="hover:text-sr-green">
          Clientes
        </Link>
        <span className="mx-2">/</span>
        <span>Nuevo</span>
      </nav>

      <h1 className="font-display text-3xl font-bold text-sr-ink">Nuevo cliente</h1>
      <p className="mt-1 text-sm text-sr-ink/55">
        {manager
          ? "Podés asignar un vendedor al crear."
          : "Se asignará a tu cartera automáticamente."}
      </p>

      {flash.error ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {flash.error}
        </p>
      ) : null}

      <form action={createCustomerAction} className="mt-6 space-y-4 rounded-xl border border-black/5 bg-white p-5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
          Razón social *
          <input
            name="legal_name"
            required
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
          Nombre de fantasía
          <input
            name="trade_name"
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
            CUIT
            <input
              name="cuit"
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
            Teléfono
            <input
              name="phone"
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
            />
          </label>
        </div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
          Email
          <input
            name="email"
            type="email"
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
          Dirección
          <input
            name="address"
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
            Ciudad
            <input
              name="city"
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
            Provincia
            <input
              name="province"
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
            />
          </label>
        </div>

        {manager ? (
          <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
            Asignar vendedor
            <select
              name="sales_rep_id"
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
            >
              <option value="">Sin asignar</option>
              {options?.salesReps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="assign_to_self" value="true" />
        )}

        <fieldset className="rounded-md border border-black/5 p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
            Contacto primario (opcional)
          </legend>
          <div className="mt-2 space-y-3">
            <input
              name="contact_name"
              placeholder="Nombre"
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="contact_email"
                type="email"
                placeholder="Email"
                className="rounded-md border border-black/10 px-3 py-2 text-sm"
              />
              <input
                name="contact_phone"
                placeholder="Teléfono"
                className="rounded-md border border-black/10 px-3 py-2 text-sm"
              />
            </div>
            <input
              name="contact_position"
              placeholder="Cargo"
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm"
            />
          </div>
        </fieldset>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary">
            Crear cliente
          </button>
          <Link href="/gestion/clientes" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
