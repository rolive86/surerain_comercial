import { redirect } from "next/navigation";
import { getCommercialSession } from "@/lib/commercial/session";

/** Admin-only gate. Shared sidebar chrome comes from (backoffice)/layout. */
export default async function DashboardGateLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getCommercialSession();
  if (!session) redirect("/login?next=/gestion/dashboard");
  if (session.claims.app_role !== "admin") {
    redirect("/gestion?error=admin_only");
  }
  return children;
}
