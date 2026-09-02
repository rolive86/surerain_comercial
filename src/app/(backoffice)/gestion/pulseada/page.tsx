import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import {
  getClienteComparativo,
  listCarteraCustomers,
  type ComparativoRow,
} from "@/lib/commercial/intel";
import { isVendedorPwaRole } from "@/lib/commercial/roles";
import { getCommercialSession } from "@/lib/commercial/session";

export const metadata: Metadata = {
  title: "Pulseada · Vendedor",
  description: "Top productos del cliente vs mismo período año anterior.",
};

export const dynamic = "force-dynamic";

function asString(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function parseLimit(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 5) return fallback;
  return Math.min(50, Math.trunc(n));
}

function shortName(descripcion: string | null, cod: string): string {
  const raw = (descripcion ?? "").trim() || cod;
  const first = raw.split(/[,\-–|/]/)[0]?.trim() || raw;
  return first.length > 28 ? `${first.slice(0, 26)}…` : first;
}

function deltaLabel(row: ComparativoRow): string {
  const delta = row.cant_anio_actual - row.cant_anio_base;
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) return "0";
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function deltaClass(row: ComparativoRow): string {
  const delta = row.cant_anio_actual - row.cant_anio_base;
  if (delta > 0) return "text-sr-green";
  if (delta < 0) return "text-red-700";
  return "text-sr-ink/45";
}

export default async function PulseadaPage({
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
  const customerId = asString(sp.customer);
  const limit = parseLimit(asString(sp.limit), 5);

  const now = new Date();
  const mesHasta = now.getMonth() + 1;
  const anioBase = now.getFullYear() - 1;

  const cartera = await listCarteraCustomers();

  let rows: ComparativoRow[] = [];
  let errorMessage: string | null = null;
  if (customerId) {
    try {
      rows = await getClienteComparativo(customerId, 1, mesHasta, anioBase);
    } catch (e) {
      errorMessage =
        e instanceof Error ? e.message : "No se pudo cargar la pulseada";
    }
  }

  const visible = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const selected = cartera.find((c) => c.id === customerId);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold text-sr-ink">Pulseada</h1>
        <p className="mt-1 text-sm text-sr-ink/55">
          Top productos vs ene–{mesLabel(mesHasta)} {anioBase} / {anioBase + 1}
        </p>
      </header>

      <form className="space-y-2">
        <label className="block text-[12px] font-semibold text-sr-ink/55">
          Cliente de tu cartera
          <select
            name="customer"
            defaultValue={customerId ?? ""}
            className="mt-1 min-h-11 w-full rounded-xl border border-sr-ink/15 bg-white px-3 text-sm"
            required
          >
            <option value="" disabled>
              Elegí un cliente…
            </option>
            {cartera.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="min-h-11 w-full rounded-xl bg-sr-green text-sm font-semibold text-white"
        >
          Ver pulseada
        </button>
      </form>

      {errorMessage ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </p>
      ) : null}

      {customerId && !errorMessage ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-sr-ink">
            {selected?.label ?? "Cliente"} · Top {visible.length}
          </h2>
          {!visible.length ? (
            <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-sr-ink/50">
              Sin historial de productos en el período.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-2xl border border-sr-mist bg-white divide-y divide-sr-mist">
              {visible.map((row) => (
                <li
                  key={row.cod_articulo}
                  className="flex items-center justify-between gap-3 px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold uppercase tracking-wide text-sr-ink">
                      {shortName(row.descripcion, row.cod_articulo)}
                    </p>
                    <p className="font-mono text-[11px] text-sr-ink/45">
                      {row.cod_articulo}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 font-display text-xl font-bold tabular-nums ${deltaClass(row)}`}
                  >
                    {deltaLabel(row)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {hasMore ? (
            <Link
              href={`/gestion/pulseada?customer=${encodeURIComponent(customerId)}&limit=${limit + 5}`}
              className="flex min-h-11 items-center justify-center rounded-xl border border-sr-green/30 bg-white text-sm font-semibold text-sr-green"
            >
              Ver más
            </Link>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function mesLabel(m: number): string {
  const labels = [
    "",
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  return labels[m] ?? String(m);
}
