import { MobileTabBar, ShopFooter, ShopHeader } from "@/components/ShopHeader";
import { isStaffRole } from "@/lib/commercial/roles";
import { getCommercialSession } from "@/lib/commercial/session";

export default async function ShopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCommercialSession();
  const hideCustomerChrome = isStaffRole(session?.claims.app_role);

  return (
    <>
      <ShopHeader />
      <main className="min-h-[70vh] pb-4 lg:pb-0">{children}</main>
      <ShopFooter />
      {hideCustomerChrome ? null : <MobileTabBar />}
    </>
  );
}
