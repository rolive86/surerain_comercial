import { redirect } from "next/navigation";
import { ShopFooter, ShopHeader } from "@/components/ShopHeader";
import { homePathForRole } from "@/lib/commercial/roles";
import { getCommercialSession } from "@/lib/commercial/session";

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCommercialSession();
  if (session) {
    redirect(homePathForRole(session.claims.app_role));
  }

  return (
    <>
      <ShopHeader />
      <main className="min-h-[70vh]">{children}</main>
      <ShopFooter />
    </>
  );
}
