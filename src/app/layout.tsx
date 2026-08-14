import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
