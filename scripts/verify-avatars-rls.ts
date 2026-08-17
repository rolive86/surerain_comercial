/**
 * Live NEGATIVE RLS test: avatars bucket.
 * Staff (sales_rep) must not write into another user's folder.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { ROOT } from "../src/config.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function isRlsDenied(error: { statusCode?: string | number; message?: string; error?: string } | null): boolean {
  if (!error) return false;
  const status = String(error.statusCode ?? "");
  const blob = `${status} ${error.message ?? ""} ${error.error ?? ""}`.toLowerCase();
  return (
    status === "403" ||
    status === "401" ||
    blob.includes("row-level security") ||
    blob.includes("row level security") ||
    blob.includes("violates") && blob.includes("policy") ||
    blob.includes("unauthorized") ||
    blob.includes("security policy")
  );
}

type StepResult = {
  name: string;
  expected: string;
  pass: boolean;
  detail: string;
};

async function main() {
  const url = requireEnv("NEXT_PUBLIC_COMMERCIAL_SUPABASE_URL");
  const anon = requireEnv("NEXT_PUBLIC_COMMERCIAL_SUPABASE_ANON_KEY");
  const customerEmail = process.env.DEMO_CUSTOMER_EMAIL ?? "cliente.demo@surerain.test";
  const staffEmail = process.env.DEMO_STAFF_EMAIL ?? "vendedor.demo@surerain.test";
  const password = requireEnv("DEMO_PASSWORD");

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: customerAuth, error: customerErr } = await supabase.auth.signInWithPassword({
    email: customerEmail,
    password,
  });
  if (customerErr || !customerAuth.user) {
    throw new Error(`Login cliente.demo failed: ${customerErr?.message ?? "no user"}`);
  }
  const customerUserId = customerAuth.user.id;
  await supabase.auth.signOut();

  const { data: staffAuth, error: staffErr } = await supabase.auth.signInWithPassword({
    email: staffEmail,
    password,
  });
  if (staffErr || !staffAuth.user) {
    throw new Error(`Login vendedor.demo failed: ${staffErr?.message ?? "no user"}`);
  }
  const staffUserId = staffAuth.user.id;
  if (staffUserId === customerUserId) {
    throw new Error("customer and staff resolved to the same auth user");
  }

  const foreignPath = `${customerUserId}/avatar.png`;
  const ownPath = `${staffUserId}/avatar.png`;

  const { data: existing } = await supabase.storage.from("avatars").list(staffUserId, {
    search: "avatar.png",
  });
  const hadOwnAvatar = Boolean(existing?.some((f) => f.name === "avatar.png"));

  const { error: foreignError } = await supabase.storage.from("avatars").upload(foreignPath, PNG_1X1, {
    upsert: true,
    contentType: "image/png",
  });

  const cross: StepResult = {
    name: "staff upload to cliente.demo folder",
    expected: "FAIL with 403 / RLS",
    pass: isRlsDenied(foreignError),
    detail: foreignError
      ? `status=${String((foreignError as { statusCode?: string }).statusCode ?? "?")} message=${foreignError.message}`
      : "UPLOAD SUCCEEDED (security hole)",
  };

  if (!foreignError) {
    await supabase.storage.from("avatars").remove([foreignPath]);
  }

  const { error: ownError } = await supabase.storage.from("avatars").upload(ownPath, PNG_1X1, {
    upsert: true,
    contentType: "image/png",
  });

  const own: StepResult = {
    name: "staff upload to own folder",
    expected: "SUCCESS",
    pass: !ownError,
    detail: ownError
      ? `status=${String((ownError as { statusCode?: string }).statusCode ?? "?")} message=${ownError.message}`
      : `uploaded ${ownPath}`,
  };

  if (!ownError && !hadOwnAvatar) {
    await supabase.storage.from("avatars").remove([ownPath]);
  }

  await supabase.auth.signOut();

  const lines = [
    "# Avatars bucket — RLS negativa (vivo)",
    "",
    `- Staff: \`${staffEmail}\` (\`${staffUserId}\`)`,
    `- Cliente path: \`${foreignPath}\``,
    `- Own path: \`${ownPath}\``,
    "",
    "| Caso | Esperado | Resultado | Detalle |",
    "|---|---|---|---|",
    `| ${cross.name} | ${cross.expected} | ${cross.pass ? "PASS" : "FAIL"} | ${cross.detail} |`,
    `| ${own.name} | ${own.expected} | ${own.pass ? "PASS" : "FAIL"} | ${own.detail} |`,
    "",
    `**Overall: ${cross.pass && own.pass ? "PASS" : "FAIL"}**`,
    "",
  ];

  const outDir = path.join(ROOT, "reports");
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "avatars-rls.md");
  writeFileSync(outFile, lines.join("\n"), "utf8");
  console.log(lines.join("\n"));

  if (!cross.pass || !own.pass) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
