import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FacturasClient } from "@/components/vendedor/FacturasClient";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import {
  listCentrosCosto,
  listMisFacturas,
  listMotivosFactura,
} from "@/lib/commercial/facturas";
import { isVendedorPwaRole } from "@/lib/commercial/roles";
import { getCommercialSession } from "@/lib/commercial/session";

export const metadata: Metadata = {
  title: "Facturas · Vendedor",
  description: "Carga de facturas de gasto y venta con OCR.",
};

export const dynamic = "force-dynamic";

export default async function FacturasPage() {
  const session = await getCommercialSession();
  requireStaffSession(session);
  if (!isVendedorPwaRole(session!.claims.app_role)) {
    redirect("/gestion");
  }

  const [facturas, centros, motivos] = await Promise.all([
    listMisFacturas(),
    listCentrosCosto(),
    listMotivosFactura(),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold text-sr-ink">Facturas</h1>
        <p className="mt-1 text-sm text-sr-ink/55">
          Subí foto o archivo · OCR precarga monto, fecha y CUIT
        </p>
      </header>

      <FacturasClient
        facturas={facturas}
        centros={centros}
        motivos={motivos}
        userId={session!.user.id}
      />
    </div>
  );
}
