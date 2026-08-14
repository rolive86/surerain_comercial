import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutCommercial } from "@/lib/commercial/auth-actions";
import { getCommercialSession, roleLabel } from "@/lib/commercial/session";
import { createCommercialServerClient } from "@/lib/supabase/commercial/server";

export const metadata: Metadata = {
  title: "Mi cuenta",
  description: "Portal B2B Sure Rain — datos de tu empresa y sesión.",
};

export default async function CuentaPage() {
  const session = await getCommercialSession();
  if (!session) {
    redirect("/login?next=/cuenta");
  }

  const supabase = await createCommercialServerClient();
  const { claims, user } = session;
  const role = claims.app_role;

  const { data: link } = await supabase
    .from("app_user_links")
    .select("role, customer_id, sales_rep_id, active")
    .eq("user_id", user.id)
    .maybeSingle();

  let customer: {
    legal_name: string;
    trade_name: string | null;
    email: string | null;
    phone: string | null;
    cuit: string | null;
    tax_condition: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
  } | null = null;

  let salesRep: { name: string; email: string | null } | null = null;
  let assignedRep: { name: string; email: string | null } | null = null;

  if (role === "customer_user" && claims.customer_id) {
    const { data } = await supabase
      .from("customers")
      .select(
        "legal_name, trade_name, email, phone, cuit, tax_condition, address, city, province, postal_code",
      )
      .eq("id", claims.customer_id)
      .maybeSingle();
    customer = data;

    const { data: csr } = await supabase
      .from("customer_sales_rep")
      .select("sales_rep_id")
      .eq("customer_id", claims.customer_id)
      .eq("active", true)
      .is("valid_to", null)
      .limit(1)
      .maybeSingle();

    if (csr?.sales_rep_id) {
      const { data: rep } = await supabase
        .from("sales_reps")
        .select("name, email")
        .eq("id", csr.sales_rep_id)
        .maybeSingle();
      assignedRep = rep;
    }
  }

  if (role === "sales_rep" && claims.sales_rep_id) {
    const { data } = await supabase
      .from("sales_reps")
      .select("name, email")
      .eq("id", claims.sales_rep_id)
      .maybeSingle();
    salesRep = data;
  }

  const addressLine = customer
    ? [customer.address, customer.city, customer.province, customer.postal_code]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="container-sr py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sr-green">
            Portal B2B
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-sr-green sm:text-4xl">
            Mi cuenta
          </h1>
          <p className="mt-2 max-w-xl text-sm text-sr-ink/60">
            Sesión autenticada del proyecto comercial. El catálogo sigue siendo público; carrito y
            pedidos llegan en fases siguientes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/catalogo" className="btn-secondary">
            Ir al catálogo
          </Link>
          <form action={signOutCommercial}>
            <button type="submit" className="btn-secondary">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InfoCard label="Email" value={user.email ?? "—"} />
        <InfoCard label="Rol" value={roleLabel(role)} />
        <InfoCard
          label="Estado del vínculo"
          value={link?.active ? "Activo" : link ? "Inactivo" : "Sin vínculo"}
        />
      </div>

      {customer ? (
        <section className="surface mt-8 p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold text-sr-ink">Tu empresa</h2>
          <p className="mt-1 text-sm text-sr-ink/55">Datos visibles vía RLS de customers.</p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <InfoCard label="Razón social" value={customer.legal_name} bare />
            {customer.trade_name ? (
              <InfoCard label="Nombre comercial" value={customer.trade_name} bare />
            ) : null}
            {customer.cuit ? <InfoCard label="CUIT" value={customer.cuit} bare /> : null}
            {customer.tax_condition ? (
              <InfoCard label="Condición fiscal" value={customer.tax_condition} bare />
            ) : null}
            {customer.email ? <InfoCard label="Email empresa" value={customer.email} bare /> : null}
            {customer.phone ? <InfoCard label="Teléfono" value={customer.phone} bare /> : null}
            {addressLine ? (
              <div className="sm:col-span-2">
                <InfoCard label="Dirección" value={addressLine} bare />
              </div>
            ) : null}
          </dl>
          {assignedRep ? (
            <div className="mt-6 rounded-lg border border-sr-green/15 bg-sr-mist/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
                Vendedor asignado
              </p>
              <p className="mt-1 text-sm font-semibold text-sr-ink">{assignedRep.name}</p>
              {assignedRep.email ? (
                <p className="text-sm text-sr-ink/60">{assignedRep.email}</p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {salesRep ? (
        <section className="surface mt-8 p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold text-sr-ink">Perfil de vendedor</h2>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <InfoCard label="Nombre" value={salesRep.name} bare />
            {salesRep.email ? <InfoCard label="Email" value={salesRep.email} bare /> : null}
          </dl>
          <p className="mt-4 text-sm text-sr-ink/55">
            La cartera de clientes se muestra con RLS (`current_rep_customer_ids`). Pedidos y
            backoffice llegan en fases posteriores.
          </p>
        </section>
      ) : null}

      <details className="surface mt-8 p-5">
        <summary className="cursor-pointer text-sm font-semibold text-sr-ink/70">
          Detalle técnico de sesión (JWT / links)
        </summary>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoCard label="app_role (JWT)" value={claims.app_role ?? "—"} bare mono />
          <InfoCard label="customer_id (JWT)" value={claims.customer_id ?? "—"} bare mono />
          <InfoCard label="sales_rep_id (JWT)" value={claims.sales_rep_id ?? "—"} bare mono />
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              app_user_links
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-sr-ink/[0.03] p-3 font-mono text-xs text-sr-ink/80">
              {link ? JSON.stringify(link, null, 2) : "sin fila / sin permiso"}
            </pre>
          </div>
        </dl>
      </details>
    </div>
  );
}

function InfoCard({
  label,
  value,
  bare = false,
  mono = false,
}: {
  label: string;
  value: string;
  bare?: boolean;
  mono?: boolean;
}) {
  const body = (
    <>
      <dt className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">{label}</dt>
      <dd className={`mt-1 text-sm font-medium ${mono ? "break-all font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </>
  );
  if (bare) return <div>{body}</div>;
  return <div className="rounded-lg border border-black/5 bg-white p-4">{body}</div>;
}
