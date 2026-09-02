import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#006A46",
};

export const metadata: Metadata = {
  title: {
    default: "Sure Rain · Catálogo de riego",
    template: "%s · Sure Rain",
  },
  description:
    "Catálogo técnico de productos de riego: aspersores, goteo, válvulas, filtros y más.",
  applicationName: "Sure Rain",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sure Rain",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
