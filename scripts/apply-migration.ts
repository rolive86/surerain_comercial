import path from "node:path";
import fs from "node:fs";
import { config as loadEnv } from "dotenv";
import { ROOT } from "../src/config.js";
import { commercialSql, requireEnv } from "./espejo/db.js";

loadEnv({ path: path.join(ROOT, ".env.local") });
requireEnv("COMMERCIAL_DATABASE_URL");

const sql = commercialSql();
const file = process.argv[2];
if (!file) throw new Error("Usage: apply-migration.ts <path.sql>");
const q = fs.readFileSync(path.join(ROOT, file), "utf8");

try {
  await sql.unsafe(q);
  console.log("applied", file);
} finally {
  await sql.end({ timeout: 5 });
}
