export const STAFF_ROLES = [
  "sales_rep",
  "sales_manager",
  "operations",
  "admin",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const CUSTOMER_ROLE = "customer_user";

export function isAdminConsoleRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "sales_manager";
}

export function isStaffRole(role: string | null | undefined): boolean {
  return Boolean(role && (STAFF_ROLES as readonly string[]).includes(role));
}

export function isCustomerRole(role: string | null | undefined): boolean {
  return role === CUSTOMER_ROLE;
}

export function homePathForRole(role: string | null | undefined): string {
  if (role === "admin") return "/gestion/dashboard";
  if (role === "sales_manager" || role === "operations") {
    return "/gestion/comercial";
  }
  return isStaffRole(role) ? "/gestion" : "/";
}

export function isBackofficePath(path: string): boolean {
  return path === "/gestion" || path.startsWith("/gestion/");
}

/** Portal autenticado de cliente (no catálogo público). */
export function isCustomerPortalPath(path: string): boolean {
  return (
    path === "/carrito" ||
    path.startsWith("/carrito/") ||
    path === "/mis-pedidos" ||
    path.startsWith("/mis-pedidos/") ||
    path === "/mis-compras" ||
    path.startsWith("/mis-compras/") ||
    path === "/pedido" ||
    path.startsWith("/pedido/") ||
    path === "/cuenta" ||
    path.startsWith("/cuenta/")
  );
}

export function isPublicCatalogPath(path: string): boolean {
  return (
    path === "/" ||
    path === "/clientes" ||
    path === "/catalogo" ||
    path.startsWith("/catalogo/")
  );
}

function isSafeRelativePath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");
}

/** Destino post-login: `next` sólo si el rol puede ir ahí. */
export function postLoginPath(
  role: string | null | undefined,
  requestedNext: string | null | undefined,
): string {
  const home = homePathForRole(role);
  const next = requestedNext?.trim() ?? "";
  if (!next || !isSafeRelativePath(next) || next === "/login") return home;

  if (isStaffRole(role)) {
    if (isBackofficePath(next)) return next;
    if (isPublicCatalogPath(next) && next !== "/") return next;
    return home;
  }

  if (isCustomerRole(role)) {
    if (isBackofficePath(next)) return home;
    return next;
  }

  return home;
}
