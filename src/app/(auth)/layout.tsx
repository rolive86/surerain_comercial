import { redirect } from "next/navigation";
import { homePathForRole } from "@/lib/commercial/roles";
import { getCommercialSession } from "@/lib/commercial/session";

/** Auth shell mínimo: sin chrome de catálogo (el login elige portal vs vendedor). */
export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCommercialSession();
  if (session) {
    redirect(homePathForRole(session.claims.app_role));
  }

  return children;
}
