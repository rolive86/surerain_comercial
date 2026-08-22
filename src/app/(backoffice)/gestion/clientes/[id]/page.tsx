import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addContactAction,
  assignSalesRepAction,
  deactivateContactAction,
  updateCustomerAction,
} from "@/lib/commercial/crm-actions";
import { saveCustomerPricingAction } from "@/lib/commercial/quote-actions";
import {
  canManageAssignments,
  getCrmCustomer,
} from "@/lib/commercial/crm";
import { getCustomerPricing } from "@/lib/commercial/quote";
import { getCommercialSession } from "@/lib/commercial/session";
import { listFilterOptions, requireStaffSession } from "@/lib/commercial/backoffice";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const data = await getCrmCustomer(id);
    return {
      title: data
        ? `${data.customer.trade_name || data.customer.legal_name} · Clientes`
        : "Cliente",
    };
  } catch {
    return { title: "Cliente" };
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR");
}

const okMsg: Record<string, string> = {
  created: "Cliente creado.",
  updated: "Datos guardados.",
  contact: "Contacto agregado.",
  contact_off: "Contacto desactivado.",
  assign: "Asignación actualizada.",
  pricing: "Markup del cliente guardado.",
};

export default async function ClienteDetailPage({
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
  const manager = canManageAssignments(staff);

  const [data, options, pricing] = await Promise.all([
    getCrmCustomer(id),
    manager ? listFilterOptions() : Promise.resolve(null),
    getCustomerPricing(id).catch(() => null),
  ]);
  if (!data) notFound();
  const { customer, contacts, assignments } = data;
  const hasActive = Boolean(customer.active_rep_id);

  return (
    <div>
      <nav className="mb-4 text-sm text-sr-ink/50">
        <Link href="/gestion/clientes" className="hover:text-sr-green">
          Clientes
        </Link>
        <span className="mx-2">/</span>
        <span>{customer.trade_name || customer.legal_name}</span>
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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-sr-ink">
            {customer.trade_name || customer.legal_name}
          </h1>
          <p className="mt-1 text-sm text-sr-ink/55">
            {customer.legal_name}
            {customer.active_rep_name ? (
              <span> · vendedor {customer.active_rep_name}</span>
            ) : (
              <span> · sin vendedor</span>
            )}
          </p>
        </div>
        <span className="chip">{customer.active ? "Activo" : "Inactivo"}</span>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-xl border border-black/5 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Datos</h2>
          <form action={updateCustomerAction} className="mt-3 space-y-3">
            <input type="hidden" name="customer_id" value={customer.id} />
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Razón social *
              <input
                name="legal_name"
                required
                defaultValue={customer.legal_name}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Nombre de fantasía
              <input
                name="trade_name"
                defaultValue={customer.trade_name ?? ""}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
                CUIT
                <input
                  name="cuit"
                  defaultValue={customer.cuit ?? ""}
                  className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
                Teléfono
                <input
                  name="phone"
                  defaultValue={customer.phone ?? ""}
                  className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
                />
              </label>
            </div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Email
              <input
                name="email"
                type="email"
                defaultValue={customer.email ?? ""}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Dirección
              <input
                name="address"
                defaultValue={customer.address ?? ""}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
                Ciudad
                <input
                  name="city"
                  defaultValue={customer.city ?? ""}
                  className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
                Provincia
                <input
                  name="province"
                  defaultValue={customer.province ?? ""}
                  className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
                />
              </label>
            </div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Estado
              <select
                name="active"
                defaultValue={customer.active ? "true" : "false"}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </label>
            <button type="submit" className="btn-primary">
              Guardar cambios
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-black/5 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Cotización · markup</h2>
          <p className="mt-1 text-sm text-sr-ink/55">
            Precio al cliente = base lista 29 × (1 + % / 100). Moneda USD.
          </p>
          <form action={saveCustomerPricingAction} className="mt-3 grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="customer_id" value={customer.id} />
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Markup %
              <input
                name="markup_pct"
                type="number"
                min={0}
                max={500}
                step={0.01}
                required
                defaultValue={pricing?.markup_pct ?? 0}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Moneda
              <input
                name="currency"
                defaultValue={pricing?.currency ?? "USD"}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
              />
            </label>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full">
                Guardar markup
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-black/5 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Asignación</h2>
          <p className="mt-2 text-sm text-sr-ink/60">
            Actual:{" "}
            <strong>{customer.active_rep_name ?? "Sin asignar"}</strong>
          </p>

          {(manager || !hasActive) && staff.claims.sales_rep_id ? (
            <form action={assignSalesRepAction} className="mt-4 space-y-3">
              <input type="hidden" name="customer_id" value={customer.id} />
              {manager && options ? (
                <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
                  Vendedor
                  <select
                    name="sales_rep_id"
                    required
                    defaultValue={customer.active_rep_id ?? ""}
                    className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
                  >
                    <option value="" disabled>
                      Seleccionar…
                    </option>
                    {options.salesReps.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input
                  type="hidden"
                  name="sales_rep_id"
                  value={staff.claims.sales_rep_id}
                />
              )}
              <button type="submit" className="btn-secondary w-full">
                {hasActive ? "Reasignar" : "Asignarme"}
              </button>
            </form>
          ) : hasActive && !manager ? (
            <p className="mt-3 text-sm text-sr-ink/45">
              Para reasignar necesitás rol de gerencia/ops/admin.
            </p>
          ) : null}

          <h3 className="mt-6 text-sm font-semibold text-sr-ink">Historial</h3>
          <ol className="mt-2 space-y-2 border-l border-sr-green/20 pl-4">
            {assignments.length === 0 ? (
              <li className="text-sm text-sr-ink/45">Sin historial.</li>
            ) : (
              assignments.map((a) => (
                <li key={a.id} className="relative text-sm">
                  <span className="absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full bg-sr-green" />
                  <p className="font-semibold">{a.sales_rep_name ?? a.sales_rep_id}</p>
                  <p className="text-xs text-sr-ink/40">
                    {formatDate(a.valid_from)}
                    {a.valid_to ? ` → ${formatDate(a.valid_to)}` : " · vigente"}
                  </p>
                </li>
              ))
            )}
          </ol>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-black/5 bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Contactos</h2>
        <ul className="mt-3 divide-y divide-black/5">
          {contacts.filter((c) => c.active).length === 0 ? (
            <li className="py-2 text-sm text-sr-ink/45">Sin contactos activos.</li>
          ) : (
            contacts
              .filter((c) => c.active)
              .map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {c.name}
                      {c.is_primary ? (
                        <span className="ml-2 text-xs text-sr-green">primario</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-sr-ink/50">
                      {[c.position, c.email, c.phone].filter(Boolean).join(" · ") ||
                        "Sin datos"}
                    </p>
                  </div>
                  <form action={deactivateContactAction}>
                    <input type="hidden" name="customer_id" value={customer.id} />
                    <input type="hidden" name="contact_id" value={c.id} />
                    <button type="submit" className="text-xs text-red-600 hover:underline">
                      Desactivar
                    </button>
                  </form>
                </li>
              ))
          )}
        </ul>

        <form
          action={addContactAction}
          className="mt-4 grid gap-3 border-t border-black/5 pt-4 sm:grid-cols-2"
        >
          <input type="hidden" name="customer_id" value={customer.id} />
          <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45 sm:col-span-2">
            Nuevo contacto
            <input
              name="name"
              required
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
            />
          </label>
          <input
            name="email"
            type="email"
            placeholder="Email"
            className="rounded-md border border-black/10 px-3 py-2 text-sm"
          />
          <input
            name="phone"
            placeholder="Teléfono"
            className="rounded-md border border-black/10 px-3 py-2 text-sm"
          />
          <input
            name="position"
            placeholder="Cargo"
            className="rounded-md border border-black/10 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-sr-ink/70">
            <input type="checkbox" name="is_primary" />
            Primario
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-secondary">
              Agregar contacto
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
