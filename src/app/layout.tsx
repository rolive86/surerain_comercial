import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sure Rain · Catálogo de riego",
    template: "%s · Sure Rain",
  },
  description:
    "Catálogo técnico de productos de riego: aspersores, goteo, válvulas, filtros y más.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <SiteHeader />
        <main className="min-h-[70vh]">{children}</main>
        <SiteFooter />
        <div className="sr-only">
          <Link href="/catalogo">Ir al catálogo</Link>
        </div>
      </body>
    </html>
  );
}
