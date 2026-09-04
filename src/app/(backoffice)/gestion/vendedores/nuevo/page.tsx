import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createRepAction } from "@/lib/commercial/crm-actions";
import { canManageReps } from "@/lib/commercial/crm";
import { getCommercialSession } from "@/lib/commercial/session";
import { requireStaffSession } from "@/lib/commercial/backoffice";

export const metadata: Metadata = {
  title: "Nuevo vendedor · Comercial",
};

export default async function NuevoVendedorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const flash = await searchParams;
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  if (!canManageReps(staff)) {
    redirect("/gestion/vendedores");
  }

  return (
    <div className="mx-auto max-w-xl">
      <nav className="mb-4 text-sm text-sr-ink/50">
        <Link href="/gestion/vendedores" className="hover:text-sr-green">
          Vendedores
        </Link>
        <span className="mx-2">/</span>
        <span>Nuevo</span>
      </nav>

      <h1 className="font-display text-3xl font-bold text-sr-ink">Nuevo vendedor</h1>

      {flash.error ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {flash.error}
        </p>
      ) : null}

      <form action={createRepAction} className="mt-6 space-y-4 rounded-xl border border-black/5 bg-white p-5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
          Nombre *
          <input
            name="name"
            required
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
          Email
          <input
            name="email"
            type="email"
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
          />
        </label>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary">
            Crear vendedor
          </button>
          <Link href="/gestion/vendedores" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
