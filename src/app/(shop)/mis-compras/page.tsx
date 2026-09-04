import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { reorderFromSalesAction } from "@/lib/commercial/cart-actions";
import { listCustomerSalesHistory } from "@/lib/commercial/sales-history";
import { getCommercialSession } from "@/lib/commercial/session";
import { getTangoProductsByCodes } from "@/lib/commercial/products-tango";

export const metadata: Metadata = {
  title: "Mis compras",
  description: "Historial de compras facturadas Sure Rain.",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value + "T12:00:00").toLocaleDateString("es-AR");
}

export default async function MisComprasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getCommercialSession();
  if (!session) redirect("/login?next=/mis-compras");
  if (session.claims.app_role !== "customer_user") {
    redirect("/cuenta?error=orders_customer_only");
  }

  const flash = await searchParams;
  const { comprobantes } = await listCustomerSalesHistory();
  const allCodes = [
    ...new Set(comprobantes.flatMap((c) => c.lines.map((l) => l.cod_articulo))),
  ];
  const products = await getTangoProductsByCodes(allCodes.slice(0, 400));
  const nameByCode = new Map(products.map((p) => [p.source_id, p.name]));

  return (
    <div className="container-sr py-10 sm:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sr-green">
            Portal
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-sr-ink sm:text-4xl">
            Mis compras
          </h1>
          <p className="mt-2 text-sm text-sr-ink/60">
            Historial facturado. Sin importes (el precio se confirma en la cotización).
          </p>
        </div>
        <Link href="/mis-pedidos" className="btn-secondary">
          Mis cotizaciones
        </Link>
      </div>

      {flash.error ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{flash.error}</p>
      ) : null}

      {comprobantes.length === 0 ? (
        <div className="surface mt-8 px-6 py-16 text-center">
          <p className="font-display text-xl text-sr-ink/70">Todavía no hay compras cargadas.</p>
          <Link href="/catalogo" className="btn-primary mt-6 inline-flex">
            Ir al catálogo
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {comprobantes.map((c) => (
            <li key={c.nro_comprobante} className="surface p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-sr-ink">
                    {c.nro_comprobante}
                  </p>
                  <p className="mt-1 text-sm text-sr-ink/55">
                    {formatDate(c.fecha)}
                    {c.tipo_comprobante ? ` · ${c.tipo_comprobante}` : ""}
                    {` · ${c.lines.length} línea(s)`}
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-sr-ink/75">
                    {c.lines.slice(0, 8).map((l, idx) => (
                      <li key={`${l.cod_articulo}-${idx}`}>
                        <span className="font-mono text-xs text-sr-ink/45">{l.cod_articulo}</span>
                        {" · "}
                        {nameByCode.get(l.cod_articulo) ?? l.cod_articulo}
                        {" · ×"}
                        {l.cantidad}
                      </li>
                    ))}
                    {c.lines.length > 8 ? (
                      <li className="text-xs text-sr-ink/45">
                        +{c.lines.length - 8} más
                      </li>
                    ) : null}
                  </ul>
                </div>
                <form action={reorderFromSalesAction}>
                  <input type="hidden" name="nro_comprobante" value={c.nro_comprobante} />
                  <button type="submit" className="btn-primary whitespace-nowrap">
                    Volver a pedir
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
