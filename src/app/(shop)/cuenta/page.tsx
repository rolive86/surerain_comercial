import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AvatarUploader } from "@/components/AvatarUploader";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { ProfileForm } from "@/components/ProfileForm";
import { signOutCommercial } from "@/lib/commercial/auth-actions";
import { getOwnProfile } from "@/lib/commercial/profile";
import { displayNameFromEmail, getCommercialSession, roleLabel } from "@/lib/commercial/session";
import { createCommercialServerClient } from "@/lib/supabase/commercial/server";

export const metadata: Metadata = {
  title: "Mi cuenta",
  description: "Perfil y empresa del portal de pedidos Sure Rain.",
};

function dash(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : "—";
}

export default async function CuentaPage() {
  const session = await getCommercialSession();
  if (!session) redirect("/login?next=/cuenta");

  const supabase = await createCommercialServerClient();
  const { claims, user } = session;
  const role = claims.app_role;
  const profile = await getOwnProfile();
  const hello = profile?.full_name?.split(/\s+/)[0] || displayNameFromEmail(user.email);

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
  let assignedRep: { name: string; email: string | null } | null = null;
  let salesRep: { name: string; email: string | null } | null = null;

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
    <div className="container-sr space-y-6 py-10 sm:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-sr-ink sm:text-4xl">Mi cuenta</h1>
          <p className="mt-1 text-sm text-sr-ink/55">
            {roleLabel(role)} · {user.email}
          </p>
        </div>
        <form action={signOutCommercial}>
          <button type="submit" className="btn-secondary">
            Cerrar sesión
          </button>
        </form>
      </div>

      <section className="surface p-5 sm:p-8">
        <h2 className="font-display text-xl font-semibold">Perfil</h2>
        <div className="mt-5">
          <AvatarUploader
            userId={user.id}
            currentUrl={profile?.avatar_url ?? null}
            initial={hello.slice(0, 1).toUpperCase()}
          />
        </div>
        <div className="mt-8">
          <ProfileForm profile={profile} />
        </div>
      </section>

      {role === "customer_user" ? (
        <section className="surface p-5 sm:p-8">
          <h2 className="font-display text-xl font-semibold">Empresa</h2>
          <p className="mt-1 text-sm text-sr-ink/55">
            Se sincroniza desde el sistema de Sure Rain (Tango). Solo lectura.
          </p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Razón social" value={dash(customer?.legal_name)} />
            <Field label="Nombre comercial" value={dash(customer?.trade_name)} />
            <Field label="CUIT" value={dash(customer?.cuit)} />
            <Field label="Condición fiscal" value={dash(customer?.tax_condition)} />
            <Field label="Email empresa" value={dash(customer?.email)} />
            <Field label="Teléfono" value={dash(customer?.phone)} />
            <div className="sm:col-span-2">
              <Field label="Dirección" value={dash(addressLine)} />
            </div>
          </dl>
          {assignedRep ? (
            <div className="mt-6 rounded-lg border border-sr-green/15 bg-sr-mist/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
                Vendedor asignado
              </p>
              <p className="mt-1 text-sm font-semibold">{assignedRep.name}</p>
              <p className="text-sm text-sr-ink/60">{dash(assignedRep.email)}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {salesRep ? (
        <section className="surface p-5 sm:p-8">
          <h2 className="font-display text-xl font-semibold">Perfil de vendedor</h2>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" value={salesRep.name} />
            <Field label="Email" value={dash(salesRep.email)} />
          </dl>
        </section>
      ) : null}

      <section className="surface p-5 sm:p-8">
        <h2 className="font-display text-xl font-semibold">Sesión</h2>
        <div className="mt-4 max-w-md">
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
