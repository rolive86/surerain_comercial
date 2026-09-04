import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StockFilters, StockList } from "@/components/vendedor/StockClient";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import {
  getTangoFamilias,
  listTangoStockRows,
} from "@/lib/commercial/products-tango";
import { isVendedorPwaRole } from "@/lib/commercial/roles";
import { getCommercialSession } from "@/lib/commercial/session";

export const metadata: Metadata = {
  title: "Stock · Vendedor",
  description: "Catálogo Tango con stock disponible.",
};

export const dynamic = "force-dynamic";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getCommercialSession();
  requireStaffSession(session);
  if (!isVendedorPwaRole(session!.claims.app_role)) {
    redirect("/gestion");
  }

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const familia =
    typeof sp.familia === "string" && sp.familia !== "all" ? sp.familia : "";

  const [familias, rows] = await Promise.all([
    getTangoFamilias(),
    listTangoStockRows({
      q: q || undefined,
      familia: familia || undefined,
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold text-sr-ink">Stock</h1>
        <p className="mt-1 text-sm text-sr-ink/55">
          Catálogo Tango · Sure Rain · {rows.length.toLocaleString("es-AR")}{" "}
          productos
        </p>
      </header>

      <Suspense fallback={null}>
        <StockFilters familias={familias} q={q} familia={familia || "all"} />
      </Suspense>

      <StockList rows={rows} />
    </div>
  );
}
