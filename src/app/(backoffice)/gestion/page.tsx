import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/commercial/backoffice";
import { homePathForRole, isVendedorPwaRole } from "@/lib/commercial/roles";
import {
  displayNameFromEmail,
  getCommercialSession,
} from "@/lib/commercial/session";
import {
  formatArs,
  formatFechaLarga,
  getVendedorHomeKpis,
} from "@/lib/commercial/vendedor-home";

export const metadata: Metadata = {
  title: "Home · Vendedor",
  description: "Resumen del día para el vendedor Sure Rain.",
};

export const dynamic = "force-dynamic";

export default async function GestionIndexPage() {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const role = session!.claims.app_role;

  if (!isVendedorPwaRole(role)) {
    if (role === "admin") redirect("/gestion/dashboard");
    if (role === "sales_manager" || role === "operations") {
      redirect("/gestion/comercial");
    }
    redirect(homePathForRole(role));
  }

  let kpis: Awaited<ReturnType<typeof getVendedorHomeKpis>> | null = null;
  let errorMessage: string | null = null;
  try {
    kpis = await getVendedorHomeKpis();
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "No se pudieron cargar los KPIs";
  }

  const hoy = kpis?.fecha ?? new Date().toISOString().slice(0, 10);
  const name = displayNameFromEmail(session!.user.email);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sr-green">
          Hoy
        </p>
        <h1 className="font-display text-2xl font-bold capitalize leading-tight text-sr-ink">
          {formatFechaLarga(hoy)}
        </h1>
        <p className="text-sm text-sr-ink/60">Hola, {name}</p>
      </header>

      {errorMessage ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </p>
      ) : null}

      <div className="grid gap-3">
        <Bubble
          label="Ventas del mes"
          value={kpis ? formatArs(kpis.ventas_mes_ars) : "—"}
          hint="Tu cartera · Sure Rain"
        />
        <Bubble
          label="Ventas Sure Rain del día"
          value={kpis ? formatArs(kpis.ventas_dia_empresa_ars) : "—"}
          hint="Toda la empresa"
        />
        <Bubble
          label="Cobranzas"
          value="Próximamente"
          hint="Pendiente de dato (tesorería / saldos)"
          pending
        />
      </div>
    </div>
  );
}

function Bubble({
  label,
  value,
  hint,
  pending,
}: {
  label: string;
  value: string;
  hint?: string;
  pending?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border px-5 py-5 ${
        pending
          ? "border-dashed border-sr-ink/20 bg-white/60"
          : "border-sr-mist bg-white shadow-sm"
      }`}
    >
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-sr-ink/55">
        {label}
      </p>
      <p
        className={`mt-2 font-display font-bold leading-none tracking-tight ${
          pending ? "text-xl text-sr-ink/45" : "text-[2rem] text-sr-green"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 text-[12px] text-sr-ink/45">{hint}</p> : null}
    </section>
  );
}
