import { GuestCartMerger } from "@/components/GuestCartMerger";
import { MobileTabBarNav } from "@/components/MobileTabBar";
import { ShopHeaderClient } from "@/components/ShopHeaderClient";
import { getOpenCartOrNull } from "@/lib/commercial/cart";
import { getHeaderIdentity } from "@/lib/commercial/profile";
import { isCustomerRole, isStaffRole } from "@/lib/commercial/roles";
import { getCommercialSession, roleLabel } from "@/lib/commercial/session";

export async function ShopHeader({ searchDefault = "" }: { searchDefault?: string }) {
  const session = await getCommercialSession();
  const isCustomer = isCustomerRole(session?.claims.app_role);
  const isStaff = isStaffRole(session?.claims.app_role);
  const cart = isCustomer ? await getOpenCartOrNull() : null;
  const identity = session ? await getHeaderIdentity() : null;

  return (
    <>
      <GuestCartMerger enabled={Boolean(isCustomer)} />
      <ShopHeaderClient
        displayName={identity?.displayName ?? null}
        avatarUrl={identity?.avatarUrl ?? null}
        email={session?.user.email ?? null}
        signedIn={Boolean(session)}
        isCustomer={isCustomer}
        isStaff={isStaff}
        cartCount={cart?.itemCount ?? 0}
        roleChip={session ? roleLabel(session.claims.app_role) : null}
        searchDefault={searchDefault}
      />
    </>
  );
}

export async function MobileTabBar() {
  const session = await getCommercialSession();
  const isCustomer = isCustomerRole(session?.claims.app_role);
  const cart = isCustomer ? await getOpenCartOrNull() : null;
  return <MobileTabBarNav cartCount={cart?.itemCount ?? 0} />;
}

export function ShopFooter() {
  return (
    <footer className="mt-16 border-t border-black/5 bg-white/50 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="container-sr flex flex-col gap-3 py-10 sm:flex-row sm:items-center sm:justify-between">
        <img src="/brand/logo-color.svg" alt="Sure Rain" className="h-7 w-auto" />
        <p className="text-sm text-sr-ink/55">
          Portal de pedidos B2B · catálogo público · datos desde Supabase
        </p>
      </div>
    </footer>
  );
}
