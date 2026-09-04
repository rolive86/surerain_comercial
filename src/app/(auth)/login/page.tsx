import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ShopFooter, ShopHeader } from "@/components/ShopHeader";
import {
  isVendedorAppContext,
  VENDEDOR_APP_COOKIE,
} from "@/lib/commercial/roles";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Ingresar",
  description: "Acceso al portal Sure Rain.",
};

function asString(v: string | string[] | undefined): string | null {
  return typeof v === "string" ? v : null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const nextPath = asString(sp.next);
  const staffError = asString(sp.error) === "staff_required";
  const jar = await cookies();
  const vendedor =
    isVendedorAppContext(asString(sp.app)) ||
    isVendedorAppContext(jar.get(VENDEDOR_APP_COOKIE)?.value);

  if (vendedor) {
    return (
      <LoginForm
        variant="vendedor"
        nextPath={nextPath}
        staffError={staffError}
      />
    );
  }

  return (
    <>
      <ShopHeader />
      <main className="min-h-[70vh]">
        <LoginForm
          variant="portal"
          nextPath={nextPath}
          staffError={staffError}
        />
      </main>
      <ShopFooter />
    </>
  );
}
