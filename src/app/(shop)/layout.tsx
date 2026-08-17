import { MobileTabBar, ShopFooter, ShopHeader } from "@/components/ShopHeader";

export default function ShopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <ShopHeader />
      <main className="min-h-[70vh] pb-4 lg:pb-0">{children}</main>
      <ShopFooter />
      <MobileTabBar />
    </>
  );
}
