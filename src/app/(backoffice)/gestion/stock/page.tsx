import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  StockFilters,
  StockList,
  type StockListRow,
} from "@/components/vendedor/StockClient";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import {
  getTangoFamilias,
  listTangoStockRows,
} from "@/lib/commercial/products-tango";
import { isVendedorPwaRole } from "@/lib/commercial/roles";
import { getCommercialSession } from "@/lib/commercial/session";
import { getStockAvailabilityMany } from "@/lib/commercial/stock";

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

  const [familias, tangoRows] = await Promise.all([
    getTangoFamilias(),
    listTangoStockRows({
      q: q || undefined,
      familia: familia || undefined,
    }),
  ]);

  let availabilityError = false;
  let avail = new Map<
    string,
    { stock_real: number; comprometido: number; libre: number }
  >();
  try {
    avail = await getStockAvailabilityMany(
      tangoRows.map((r) => r.cod_articulo),
    );
  } catch {
    availabilityError = true;
  }

  const rows: StockListRow[] = tangoRows.map((r) => {
    const a = avail.get(r.cod_articulo);
    return {
      cod_articulo: r.cod_articulo,
      descripcion: r.descripcion,
      familia: r.familia,
      image_url: r.image_url,
      stock_qty: r.stock_qty,
      stock_real: a?.stock_real ?? null,
      comprometido: a?.comprometido ?? null,
      libre: a?.libre ?? null,
      availabilityError,
    };
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold text-sr-ink">Stock</h1>
        <p className="mt-1 text-sm text-sr-ink/55">
          Disponible (libre) · Catálogo Tango ·{" "}
          {rows.length.toLocaleString("es-AR")} productos
        </p>
      </header>

      {availabilityError ? (
        <p
          className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          No se pudo consultar la disponibilidad. Los cupos no se muestran como
          0.
        </p>
      ) : null}

      <Suspense fallback={null}>
        <StockFilters familias={familias} q={q} familia={familia || "all"} />
      </Suspense>

      <StockList rows={rows} />
    </div>
  );
}
