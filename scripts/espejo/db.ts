import path from "node:path";
import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { ROOT } from "../../src/config.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

export function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name} in .env.local`);
  return v;
}

/** Direct Postgres to commercial DB (FDW / inspect). Not the REST URL. */
export function commercialSql() {
  const url = requireEnv("COMMERCIAL_DATABASE_URL");
  return postgres(url, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 30,
    prepare: false,
  });
}

export function espejoRemoteOptions() {
  return {
    host: requireEnv("ESPEJO_HOST"),
    port: requireEnv("ESPEJO_PORT"),
    db: requireEnv("ESPEJO_DB"),
    user: requireEnv("ESPEJO_USER"),
    password: requireEnv("ESPEJO_PASSWORD"),
  };
}

export function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
