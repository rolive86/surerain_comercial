import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { signOutCommercial } from "./actions";

export const metadata: Metadata = {
  title: "Mi cuenta",
  description: "Sesión B2B Sure Rain (validación Fase A).",
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default async function CuentaPage() {
  const supabase = await createCommercialServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/cuenta");
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const claims = sessionData.session?.access_token
    ? decodeJwtPayload(sessionData.session.access_token)
    : null;

  const appRole = (claims?.app_role as string | undefined) ?? "—";
  const customerId = (claims?.customer_id as string | undefined) ?? "—";
  const salesRepId = (claims?.sales_rep_id as string | undefined) ?? "—";

  const { data: link } = await supabase
    .from("app_user_links")
    .select("role, customer_id, sales_rep_id, active")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="container-sr py-12">
      <h1 className="font-display text-3xl font-bold text-sr-green">Mi cuenta</h1>
      <p className="mt-2 max-w-2xl text-sm text-sr-ink/60">
        Placeholder de Fase A para validar Auth + claims JWT del proyecto comercial. Sin shop ni
        carrito.
      </p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-black/5 bg-white p-4">
          <dt className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">Email</dt>
          <dd className="mt-1 text-sm font-medium">{user.email}</dd>
        </div>
        <div className="rounded-lg border border-black/5 bg-white p-4">
          <dt className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
            app_role (JWT)
          </dt>
          <dd className="mt-1 font-mono text-sm font-medium">{appRole}</dd>
        </div>
        <div className="rounded-lg border border-black/5 bg-white p-4">
          <dt className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
            customer_id (JWT)
          </dt>
          <dd className="mt-1 break-all font-mono text-xs">{customerId}</dd>
        </div>
        <div className="rounded-lg border border-black/5 bg-white p-4">
          <dt className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
            sales_rep_id (JWT)
          </dt>
          <dd className="mt-1 break-all font-mono text-xs">{salesRepId}</dd>
        </div>
        <div className="rounded-lg border border-black/5 bg-white p-4 sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
            app_user_links (RLS)
          </dt>
          <dd className="mt-2 whitespace-pre-wrap font-mono text-xs">
            {link ? JSON.stringify(link, null, 2) : "sin fila / sin permiso"}
          </dd>
        </div>
      </dl>

      <form action={signOutCommercial} className="mt-8">
        <button type="submit" className="btn-secondary">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
