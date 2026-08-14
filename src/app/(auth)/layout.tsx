import { ShopFooter, ShopHeader } from "@/components/ShopHeader";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <ShopHeader />
      <main className="min-h-[70vh]">{children}</main>
      <ShopFooter />
    </>
  );
}
