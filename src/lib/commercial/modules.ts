import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { getCommercialSession } from "@/lib/commercial/session";

export type ModuleCode =
  | "catalogo"
  | "carrito"
  | "mis_pedidos"
  | "seguir_pedido"
  | "cuenta"
  | "gestion_pedidos"
  | "gestion_clientes"
  | "gestion_vendedores"
  | "admin_console";

export type ModuleFlag = {
  module: string;
  label: string;
  sort_order: number;
  can_view: boolean;
  can_edit: boolean;
};

const FALLBACK_VIEW: Record<string, ModuleCode[]> = {
  customer_user: ["catalogo", "carrito", "mis_pedidos", "seguir_pedido", "cuenta"],
  sales_rep: ["catalogo", "cuenta", "gestion_pedidos", "gestion_clientes", "gestion_vendedores"],
  operations: ["catalogo", "cuenta", "gestion_pedidos", "gestion_clientes", "gestion_vendedores"],
  sales_manager: [
    "catalogo",
    "cuenta",
    "gestion_pedidos",
    "gestion_clientes",
    "gestion_vendedores",
    "admin_console",
  ],
  admin: [
    "catalogo",
    "carrito",
    "mis_pedidos",
    "seguir_pedido",
    "cuenta",
    "gestion_pedidos",
    "gestion_clientes",
    "gestion_vendedores",
    "admin_console",
  ],
};

export function canViewModule(
  flags: Record<string, boolean> | null | undefined,
  code: ModuleCode,
  role?: string | null,
): boolean {
  if (flags && Object.prototype.hasOwnProperty.call(flags, code)) {
    return flags[code] === true;
  }
  if (!role) return code === "catalogo";
  return (FALLBACK_VIEW[role] ?? []).includes(code);
}

export async function getModuleViewFlags(
  role?: string | null,
): Promise<Record<string, boolean>> {
  const session = await getCommercialSession();
  const appRole = role ?? session?.claims.app_role;
  const out: Record<string, boolean> = {};
  if (!appRole || !session) {
    out.catalogo = true;
    return out;
  }

  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("module_permissions")
    .select("module, can_view")
    .eq("role", appRole);
  if (error || !data?.length) {
    for (const code of FALLBACK_VIEW[appRole] ?? []) out[code] = true;
    return out;
  }
  for (const row of data) out[row.module] = row.can_view;
  return out;
}

export async function listModulePermissionMatrix(): Promise<{
  modules: Array<{ code: string; label: string; sort_order: number }>;
  rows: Array<{ role: string; module: string; can_view: boolean; can_edit: boolean }>;
}> {
  const supabase = await createCommercialServerClient();
  const [{ data: modules, error: mErr }, { data: perms, error: pErr }] = await Promise.all([
    supabase.from("app_modules").select("code, label, sort_order").order("sort_order"),
    supabase.from("module_permissions").select("role, module, can_view, can_edit"),
  ]);
  if (mErr) throw new Error(mErr.message);
  if (pErr) throw new Error(pErr.message);
  return { modules: modules ?? [], rows: perms ?? [] };
}
