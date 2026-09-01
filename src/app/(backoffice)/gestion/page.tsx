import { redirect } from "next/navigation";
import { homePathForRole, isStaffRole } from "@/lib/commercial/roles";
import { getCommercialSession } from "@/lib/commercial/session";

export default async function GestionIndexPage() {
  const session = await getCommercialSession();
  const role = session?.claims.app_role;
  if (role === "admin") {
    redirect("/gestion/dashboard");
  }
  if (isStaffRole(role)) {
    redirect("/gestion/pedidos");
  }
  redirect(homePathForRole(role));
}
