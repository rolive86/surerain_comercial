import Link from "next/link";
import { ShopFooter, ShopHeader } from "@/components/ShopHeader";

export default function ShopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <ShopHeader />
      <main className="min-h-[70vh]">{children}</main>
      <ShopFooter />
      <div className="sr-only">
        <Link href="/catalogo">Ir al catálogo</Link>
      </div>
    </>
  );
}
