import type { Metadata } from "next";
import Link from "next/link";
import { NuevaCotizacionForm } from "@/components/NuevaCotizacionForm";
import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { getCommercialSession } from "@/lib/commercial/session";
import { requireStaffSession } from "@/lib/commercial/backoffice";

export const metadata: Metadata = {
  title: "Nueva cotización",
  description: "Cotización telefónica a nombre de un cliente de la cartera.",
};

export const dynamic = "force-dynamic";

export default async function NuevaCotizacionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const flash = await searchParams;
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();

  const [{ data: customers }, { data: products }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, legal_name, trade_name")
      .eq("active", true)
      .order("legal_name")
      .limit(2000),
    supabase
      .from("products_tango")
      .select("cod_articulo, descripcion")
      .eq("active", true)
      .order("descripcion")
      .limit(3000),
  ]);

  const customerOpts = (customers ?? []).map((c) => ({
    id: c.id,
    label: c.trade_name || c.legal_name,
  }));

  return (
    <div>
      <nav className="mb-4 text-sm text-sr-ink/50">
        <Link href="/gestion/pedidos" className="hover:text-sr-green">
          Pedidos
        </Link>
        <span className="mx-2">/</span>
        <span>Nueva cotización</span>
      </nav>
      <h1 className="font-display text-3xl font-bold text-sr-ink">Nueva cotización</h1>
      <p className="mt-2 text-sm text-sr-ink/60">
        Venta telefónica: elegí un cliente de tu cartera, agregá artículos Tango y guardá
        (estado Cotizada, precios auto).
      </p>
      {flash.error ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{flash.error}</p>
      ) : null}
      <div className="mt-6">
        {customerOpts.length === 0 ? (
          <p className="text-sm text-sr-ink/60">No hay clientes visibles en tu cartera.</p>
        ) : (
          <NuevaCotizacionForm
            customers={customerOpts}
            products={products ?? []}
          />
        )}
      </div>
    </div>
  );
}
