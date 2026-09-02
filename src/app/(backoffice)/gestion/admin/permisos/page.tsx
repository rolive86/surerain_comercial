import { saveModulePermissionsAction } from "@/lib/commercial/admin-actions";
import { listModulePermissionMatrix } from "@/lib/commercial/modules";

export const dynamic = "force-dynamic";

const ROLES = [
  { id: "customer_user", label: "Cliente" },
  { id: "sales_rep", label: "Vendedor" },
  { id: "sales_manager", label: "Gerente" },
  { id: "operations", label: "Comercial" },
  { id: "admin", label: "Admin" },
];

export default async function AdminPermisosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { modules, rows } = await listModulePermissionMatrix();
  const lookup = new Map(rows.map((r) => [`${r.role}:${r.module}`, r]));

  return (
    <div className="space-y-4">
      {params.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{params.error}</p>
      ) : null}
      {params.ok ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Permisos de visibilidad actualizados (UX). La RLS no cambia.
        </p>
      ) : null}
      <p className="text-sm text-sr-ink/55">
        Los toggles ocultan entradas de menú. No otorgan acceso a datos protegidos por RLS.
      </p>
      <form action={saveModulePermissionsAction} className="overflow-x-auto rounded-xl border border-black/5 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-black/5 text-xs uppercase text-sr-ink/45">
            <tr>
              <th className="px-3 py-3">Módulo</th>
              {ROLES.map((r) => (
                <th key={r.id} className="px-3 py-3 text-center">
                  {r.label}
                  <span className="mt-0.5 block font-normal normal-case">ver</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {modules.map((mod) => (
              <tr key={mod.code}>
                <td className="px-3 py-2 font-semibold">{mod.label}</td>
                {ROLES.map((r) => {
                  const row = lookup.get(`${r.id}:${mod.code}`);
                  return (
                    <td key={r.id} className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        name={`view:${r.id}:${mod.code}`}
                        defaultChecked={row?.can_view ?? false}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-black/5 p-4">
          <button type="submit" className="btn-primary">
            Guardar visibilidad
          </button>
        </div>
      </form>
    </div>
  );
}
