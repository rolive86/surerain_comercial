import { listAdminMetrics } from "@/lib/commercial/admin-console";

export const dynamic = "force-dynamic";

export default async function AdminMetricasPage() {
  const m = await listAdminMetrics();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Pedidos últimos 30 días" value={m.orders30} />
        <Kpi label="Clientes activos" value={m.customersActive} />
        <Kpi label="Vendedores activos" value={m.repsActive} />
      </div>
      <section className="rounded-xl border border-black/5 bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Pedidos por estado</h2>
        <ul className="mt-3 divide-y divide-black/5">
          {m.byStatus.map((s) => (
            <li key={s.code} className="flex justify-between py-2 text-sm">
              <span>{s.label}</span>
              <span className="font-semibold">{s.count}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border border-black/5 bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Top productos pedidos</h2>
        {m.topProducts.length === 0 ? (
          <p className="mt-2 text-sm text-sr-ink/45">Todavía no hay ítems de pedido.</p>
        ) : (
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
            {m.topProducts.map((p) => (
              <li key={p.source_id}>
                {p.name}{" "}
                <span className="text-sr-ink/45">
                  ({p.qty} u. · {p.source_id})
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-5">
      <p className="text-xs uppercase tracking-wider text-sr-ink/45">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-sr-green">{value}</p>
    </div>
  );
}
