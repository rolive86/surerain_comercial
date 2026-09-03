import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RendicionClient } from "@/components/vendedor/RendicionClient";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import {
  listConceptosRendicion,
  listMisComprobantes,
} from "@/lib/commercial/rendiciones";
import { isVendedorPwaRole } from "@/lib/commercial/roles";
import { getCommercialSession } from "@/lib/commercial/session";

export const metadata: Metadata = {
  title: "Rendición · Vendedor",
  description: "Rendición de gastos con OCR y catálogo de conceptos.",
};

export const dynamic = "force-dynamic";

export default async function RendicionPage() {
  const session = await getCommercialSession();
  requireStaffSession(session);
  if (!isVendedorPwaRole(session!.claims.app_role)) {
    redirect("/gestion");
  }

  const [comprobantes, conceptos] = await Promise.all([
    listMisComprobantes(),
    listConceptosRendicion(),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold text-sr-ink">
          Rendición
        </h1>
        <p className="mt-1 text-sm text-sr-ink/55">
          Subí foto o archivo · OCR precarga total, fecha y CUIT
        </p>
      </header>

      <RendicionClient
        comprobantes={comprobantes}
        conceptos={conceptos}
        userId={session!.user.id}
      />
    </div>
  );
}
