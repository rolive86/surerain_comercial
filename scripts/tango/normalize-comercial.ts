/**
 * Normalize tango.vendedores_raw / clientes_raw → public.sales_reps / customers / customer_sales_rep.
 * Does not touch prices or catalog. Service role only. Idempotent. Skips platform demos
 * (rows without tango_* ids).
 */
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { ROOT } from "../../src/config.js";
import type { Database, Json } from "../../src/types/commercial.types.js";

loadEnv({ path: path.join(ROOT, ".env.local") });

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function asText(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function asBool(value: unknown): boolean | null {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return null;
}

function taxCondition(raw: Record<string, unknown>): string | null {
  return (
    asText(raw.desc_categoria_iva) ||
    asText(raw.gva41_desc_iva) ||
    asText(raw.tax_condition) ||
    null
  );
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_COMMERCIAL_SUPABASE_URL");
  const service = requireEnv("COMMERCIAL_SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient<Database>(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: runId, error: startErr } = await supabase.rpc("tango_staging_run_start", {
    p_entity: "comercial",
    p_source: "normalize_comercial",
    p_meta: { entities: ["vendedores", "clientes", "asignaciones"] },
  });
  if (startErr || !runId) throw new Error(startErr?.message ?? "sync_run start failed");

  let read = 0;
  let upserted = 0;
  let failed = 0;

  try {
    const [{ data: vendJson, error: vendErr }, { data: cliJson, error: cliErr }] =
      await Promise.all([
        supabase.rpc("tango_staging_fetch", { p_entity: "vendedores" }),
        supabase.rpc("tango_staging_fetch", { p_entity: "clientes" }),
      ]);
    if (vendErr) throw new Error(vendErr.message);
    if (cliErr) throw new Error(cliErr.message);
    const vendedores = Array.isArray(vendJson) ? (vendJson as Json[]) : [];
    const clientes = Array.isArray(cliJson) ? (cliJson as Json[]) : [];
    read = vendedores.length + clientes.length;

    const now = new Date().toISOString();
    const seenRepCodes = new Set<string>();
    const repRows: Array<{
      tango_sales_rep_id: string;
      external_id: string | null;
      name: string;
      active: boolean;
      source_system: string;
      last_synced_at: string;
      sync_status: string;
    }> = [];

    for (const raw of vendedores) {
      if (!raw || typeof raw !== "object") {
        failed += 1;
        continue;
      }
      const r = raw as Record<string, unknown>;
      const code = asText(r.cod_gva23);
      const name = asText(r.nombre);
      if (!code || !name) {
        failed += 1;
        continue;
      }
      if (seenRepCodes.has(code)) continue;
      seenRepCodes.add(code);
      const inhabilitado = asBool(r.inhabilitado) ?? false;
      repRows.push({
        tango_sales_rep_id: code,
        external_id: asText(r.id_gva23),
        name,
        active: !inhabilitado,
        source_system: "tango",
        last_synced_at: now,
        sync_status: "ok",
      });
    }

    if (repRows.length) {
      const { error } = await supabase.from("sales_reps").upsert(repRows, {
        onConflict: "tango_sales_rep_id",
      });
      if (error) throw new Error(`sales_reps upsert: ${error.message}`);
      upserted += repRows.length;
    }

    const seenCustCodes = new Set<string>();
    const custRows: Array<{
      tango_customer_id: string;
      external_id: string | null;
      legal_name: string;
      cuit: string | null;
      email: string | null;
      tax_condition: string | null;
      active: boolean;
      source_system: string;
      last_synced_at: string;
      sync_status: string;
    }> = [];
    const assignmentIntent: Array<{ tangoCustomerId: string; vendorCode: string | null }> = [];

    for (const raw of clientes) {
      if (!raw || typeof raw !== "object") {
        failed += 1;
        continue;
      }
      const r = raw as Record<string, unknown>;
      const code = asText(r.cod_gva14);
      const legal = asText(r.razon_social);
      if (!code || !legal) {
        failed += 1;
        continue;
      }
      if (seenCustCodes.has(code)) continue;
      seenCustCodes.add(code);
      const payload =
        r.raw_payload && typeof r.raw_payload === "object"
          ? (r.raw_payload as Record<string, unknown>)
          : r;
      custRows.push({
        tango_customer_id: code,
        external_id: asText(r.id_gva14),
        legal_name: legal,
        cuit: asText(r.cuit),
        email: asText(r.email),
        tax_condition: taxCondition(payload),
        active: asBool(r.habilitado) ?? true,
        source_system: "tango",
        last_synced_at: now,
        sync_status: "ok",
      });
      assignmentIntent.push({
        tangoCustomerId: code,
        vendorCode: asText(r.cod_vendedor),
      });
    }

    if (custRows.length) {
      const { error } = await supabase.from("customers").upsert(custRows, {
        onConflict: "tango_customer_id",
      });
      if (error) throw new Error(`customers upsert: ${error.message}`);
      upserted += custRows.length;
    }

    const [{ data: repsDb, error: repsErr }, { data: custsDb, error: custsErr }] =
      await Promise.all([
        supabase.from("sales_reps").select("id, tango_sales_rep_id").not("tango_sales_rep_id", "is", null),
        supabase.from("customers").select("id, tango_customer_id").not("tango_customer_id", "is", null),
      ]);
    if (repsErr) throw new Error(repsErr.message);
    if (custsErr) throw new Error(custsErr.message);

    const repByCode = new Map(
      (repsDb ?? [])
        .filter((r) => r.tango_sales_rep_id)
        .map((r) => [r.tango_sales_rep_id as string, r.id]),
    );
    const custByCode = new Map(
      (custsDb ?? [])
        .filter((c) => c.tango_customer_id)
        .map((c) => [c.tango_customer_id as string, c.id]),
    );
    const tangoCustomerIds = [...custByCode.values()];

    const { data: links, error: linksErr } = tangoCustomerIds.length
      ? await supabase
          .from("customer_sales_rep")
          .select("id, customer_id, sales_rep_id, active, valid_to, source_system")
          .in("customer_id", tangoCustomerIds)
          .eq("active", true)
          .is("valid_to", null)
      : { data: [], error: null };
    if (linksErr) throw new Error(linksErr.message);

    const currentByCustomer = new Map(
      (links ?? []).map((l) => [l.customer_id, l]),
    );

    let assignmentsUpserted = 0;
    for (const intent of assignmentIntent) {
      const customerId = custByCode.get(intent.tangoCustomerId);
      if (!customerId) {
        failed += 1;
        continue;
      }
      if (!intent.vendorCode) continue;
      const salesRepId = repByCode.get(intent.vendorCode);
      if (!salesRepId) {
        failed += 1;
        continue;
      }
      const current = currentByCustomer.get(customerId);
      if (current && current.sales_rep_id === salesRepId) {
        if (current.source_system !== "tango") {
          const { error } = await supabase
            .from("customer_sales_rep")
            .update({ source_system: "tango" })
            .eq("id", current.id);
          if (error) throw new Error(error.message);
        }
        continue;
      }
      if (current && current.sales_rep_id !== salesRepId) {
        const { error } = await supabase
          .from("customer_sales_rep")
          .update({ active: false, valid_to: now })
          .eq("id", current.id);
        if (error) throw new Error(`close assignment: ${error.message}`);
      }
      const { error: insErr } = await supabase.from("customer_sales_rep").insert({
        customer_id: customerId,
        sales_rep_id: salesRepId,
        active: true,
        valid_from: now,
        valid_to: null,
        source_system: "tango",
      });
      if (insErr) throw new Error(`assign ${intent.tangoCustomerId}: ${insErr.message}`);
      assignmentsUpserted += 1;
    }
    upserted += assignmentsUpserted;

    const { error: finErr } = await supabase.rpc("tango_staging_run_finish", {
      p_id: runId,
      p_status: "ok",
      p_read: read,
      p_upserted: upserted,
      p_failed: failed,
    });
    if (finErr) throw new Error(finErr.message);

    console.log(
      JSON.stringify(
        {
          runId,
          vendedoresStaging: vendedores.length,
          clientesStaging: clientes.length,
          salesRepsUpserted: repRows.length,
          customersUpserted: custRows.length,
          assignmentsOpened: assignmentsUpserted,
          failed,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.rpc("tango_staging_run_finish", {
      p_id: runId,
      p_status: "error",
      p_read: read,
      p_upserted: upserted,
      p_failed: failed,
      p_error: msg,
    });
    throw err;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
