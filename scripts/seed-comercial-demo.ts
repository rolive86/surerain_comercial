/**
 * Create or link comercial.demo@surerain.test (Auth + app_user_links).
 * Role: sales_manager (ve todo el backoffice comercial; reutiliza rol existente).
 * Requires DEMO_PASSWORD in .env.local.
 */
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { ROOT } from "../src/config.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_COMMERCIAL_SUPABASE_URL");
  const service = requireEnv("COMMERCIAL_SUPABASE_SERVICE_ROLE_KEY");
  const password =
    process.env.DEMO_PASSWORD?.trim() || "SureRain-Demo-2026!";
  if (!process.env.DEMO_PASSWORD?.trim()) {
    console.warn("DEMO_PASSWORD unset; using built-in demo fallback");
  }
  const email = process.env.DEMO_COMERCIAL_EMAIL ?? "comercial.demo@surerain.test";
  const role = "sales_manager";

  const supabase = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  let userId = created.user?.id ?? null;
  if (createErr) {
    const msg = createErr.message.toLowerCase();
    if (!msg.includes("already") && !msg.includes("registered") && createErr.status !== 422) {
      throw new Error(createErr.message);
    }
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 200 });
    if (listErr) throw new Error(listErr.message);
    const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) throw new Error(`User exists but could not be listed: ${email}`);
    userId = existing.id;
    const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updErr) throw new Error(updErr.message);
  }
  if (!userId) throw new Error("No user id");

  const { error: linkErr } = await supabase.from("app_user_links").upsert({
    user_id: userId,
    role,
    customer_id: null,
    sales_rep_id: null,
    active: true,
  });
  if (linkErr) throw new Error(linkErr.message);

  console.log(JSON.stringify({ email, user_id: userId, role }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
