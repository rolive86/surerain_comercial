import { createCommercialAdminClient } from "@/lib/supabase/commercial/admin";
import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { getCommercialSession } from "@/lib/commercial/session";
import { isStaffRole } from "@/lib/commercial/roles";
import { requireStaffSession } from "@/lib/commercial/backoffice";

export type CustomerPricingRow = {
  customer_id: string;
  markup_pct: number;
  currency: string;
  updated_at: string;
};

async function assertCustomerInPortfolio(customerId: string): Promise<{
  userId: string;
  role: string;
  salesRepId: string | null;
}> {
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  const role = staff.claims.app_role ?? "";
  if (!isStaffRole(role)) throw new Error("STAFF_REQUIRED");

  if (role === "sales_rep") {
    const supabase = await createCommercialServerClient();
    const { data, error } = await supabase
      .from("customer_sales_rep")
      .select("customer_id")
      .eq("customer_id", customerId)
      .eq("active", true)
      .is("valid_to", null)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("CUSTOMER_OUT_OF_PORTFOLIO");
  }

  return {
    userId: staff.user.id,
    role,
    salesRepId: staff.claims.sales_rep_id ?? null,
  };
}

export async function getCustomerPricing(
  customerId: string,
): Promise<CustomerPricingRow | null> {
  await assertCustomerInPortfolio(customerId);
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("customer_pricing")
    .select("customer_id, markup_pct, currency, updated_at")
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    ...data,
    markup_pct: Number(data.markup_pct),
  };
}

export async function upsertCustomerPricing(input: {
  customerId: string;
  markupPct: number;
  currency?: string;
}): Promise<void> {
  const { userId } = await assertCustomerInPortfolio(input.customerId);
  const markup = Number(input.markupPct);
  if (!Number.isFinite(markup) || markup < 0 || markup > 500) {
    throw new Error("INVALID_MARKUP");
  }
  const currency = (input.currency ?? "USD").trim().toUpperCase() || "USD";
  const admin = createCommercialAdminClient();
  const { error } = await admin.from("customer_pricing").upsert(
    {
      customer_id: input.customerId,
      markup_pct: markup,
      currency,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "customer_id" },
  );
  if (error) throw new Error(error.message);
}

async function resolveCodArticulo(
  productSourceId: string,
): Promise<string> {
  if (!productSourceId.startsWith("img:")) return productSourceId;
  const supabase = await createCommercialServerClient();
  const { data } = await supabase
    .from("product_map")
    .select("cod_articulo")
    .eq("source_id", productSourceId)
    .maybeSingle();
  return data?.cod_articulo ?? productSourceId;
}

export async function quoteUnitPrice(
  codArticulo: string,
  customerId: string,
): Promise<number | null> {
  await assertCustomerInPortfolio(customerId);
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase.rpc("quote_unit_price", {
    p_cod_articulo: codArticulo,
    p_customer: customerId,
  });
  if (error) throw new Error(error.message);
  if (data == null) return null;
  const n = Number(data);
  return Number.isFinite(n) ? n : null;
}

/** Autocompleta precios y deja la orden en quoted. */
export async function saveQuoteForOrder(input: {
  orderId: string;
  prices: Record<string, number | null>;
  validDays?: number;
}): Promise<void> {
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  const supabase = await createCommercialServerClient();
  const admin = createCommercialAdminClient();

  const { data: order, error: findErr } = await supabase
    .from("orders")
    .select("id, status, order_number, customer_id")
    .eq("id", input.orderId)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  await assertCustomerInPortfolio(order.customer_id);

  if (!["submitted", "quoted", "received"].includes(order.status)) {
    throw new Error("ORDER_NOT_QUOTABLE");
  }

  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("id, product_source_id, product_name_snapshot")
    .eq("order_id", order.id);
  if (itemsErr) throw new Error(itemsErr.message);

  for (const item of items ?? []) {
    const raw = input.prices[item.id];
    let amount: number | null =
      raw === undefined || raw === null || raw === ("" as unknown)
        ? null
        : Number(raw);
    if (amount == null || !Number.isFinite(amount)) {
      const cod = await resolveCodArticulo(item.product_source_id);
      amount = await quoteUnitPrice(cod, order.customer_id);
    }
    if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
      throw new Error("INVALID_PRICE");
    }
    const { error: updErr } = await admin
      .from("order_items")
      .update({
        unit_price_snapshot: amount,
        sku_snapshot:
          (await resolveCodArticulo(item.product_source_id)) || null,
      })
      .eq("id", item.id)
      .eq("order_id", order.id);
    if (updErr) throw new Error(updErr.message);
  }

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + (input.validDays ?? 15));
  const fromStatus = order.status;

  const { error: ordErr } = await admin
    .from("orders")
    .update({
      status: "quoted",
      quote_valid_until: validUntil.toISOString(),
    })
    .eq("id", order.id);
  if (ordErr) throw new Error(ordErr.message);

  if (fromStatus !== "quoted") {
    await admin.from("order_status_history").insert({
      order_id: order.id,
      from_status: fromStatus,
      to_status: "quoted",
      changed_by: staff.user.id,
      comment: "Cotización guardada (precios por cliente)",
    });
  }

  await admin.from("audit_log").insert({
    actor_user_id: staff.user.id,
    action: "quote_saved",
    entity_type: "order",
    entity_id: order.id,
    before: { status: fromStatus },
    after: { status: "quoted", order_number: order.order_number },
  });
}

export type TelephoneQuoteLine = {
  cod_articulo: string;
  quantity: number;
  unit_price?: number | null;
  product_name?: string;
};

export async function createTelephoneQuote(input: {
  customerId: string;
  lines: TelephoneQuoteLine[];
  note?: string;
}): Promise<{ orderId: string; orderNumber: string }> {
  const { userId, salesRepId } = await assertCustomerInPortfolio(input.customerId);
  if (!input.lines.length) throw new Error("EMPTY_QUOTE");

  const admin = createCommercialAdminClient();
  const supabase = await createCommercialServerClient();

  const { data: orderNumber, error: numErr } = await supabase.rpc("next_order_number");
  if (numErr || !orderNumber) throw new Error(numErr?.message ?? "ORDER_NUMBER_FAILED");

  let repId = salesRepId;
  if (!repId) {
    const { data: csr } = await supabase
      .from("customer_sales_rep")
      .select("sales_rep_id")
      .eq("customer_id", input.customerId)
      .eq("active", true)
      .is("valid_to", null)
      .limit(1)
      .maybeSingle();
    repId = csr?.sales_rep_id ?? null;
  }

  const codes = input.lines.map((l) => l.cod_articulo);
  const { data: tangoRows } = await supabase
    .from("products_tango")
    .select("cod_articulo, descripcion, unidad")
    .in("cod_articulo", codes);
  const byCode = new Map((tangoRows ?? []).map((r) => [r.cod_articulo, r]));

  const now = new Date().toISOString();
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 15);

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_id: input.customerId,
      user_id: userId,
      sales_rep_id: repId,
      status: "quoted",
      submitted_at: now,
      source: "rep",
      quote_valid_until: validUntil.toISOString(),
    })
    .select("id, order_number")
    .single();
  if (orderErr) throw new Error(orderErr.message);

  const itemRows = [];
  for (const line of input.lines) {
    const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
    const art = byCode.get(line.cod_articulo);
    let price =
      line.unit_price != null && Number.isFinite(Number(line.unit_price))
        ? Number(line.unit_price)
        : await quoteUnitPrice(line.cod_articulo, input.customerId);
    itemRows.push({
      order_id: order.id,
      product_source_id: line.cod_articulo,
      product_name_snapshot:
        line.product_name?.trim() ||
        art?.descripcion?.trim() ||
        line.cod_articulo,
      product_slug_snapshot: `t/${encodeURIComponent(line.cod_articulo)}`,
      sku_snapshot: line.cod_articulo,
      unit_snapshot: art?.unidad ?? null,
      quantity: qty,
      unit_price_snapshot: price,
      discount_snapshot: null,
      metadata_snapshot: {},
    });
  }

  const { error: itemsErr } = await admin.from("order_items").insert(itemRows);
  if (itemsErr) throw new Error(itemsErr.message);

  await admin.from("order_status_history").insert({
    order_id: order.id,
    from_status: null,
    to_status: "quoted",
    changed_by: userId,
    comment: "Cotización telefónica creada por vendedor",
  });

  const note = input.note?.trim();
  if (note) {
    await admin.from("order_notes").insert({
      order_id: order.id,
      note_type: "internal",
      body: note,
      author_user_id: userId,
    });
  }

  return { orderId: order.id, orderNumber: order.order_number };
}

/** Precios sugeridos para líneas de una orden. */
export async function suggestedPricesForOrder(
  orderId: string,
): Promise<Record<string, number | null>> {
  const supabase = await createCommercialServerClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, customer_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  await assertCustomerInPortfolio(order.customer_id);

  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("id, product_source_id, unit_price_snapshot")
    .eq("order_id", orderId);
  if (itemsErr) throw new Error(itemsErr.message);

  const out: Record<string, number | null> = {};
  for (const item of items ?? []) {
    if (item.unit_price_snapshot != null) {
      out[item.id] = Number(item.unit_price_snapshot);
      continue;
    }
    const cod = await resolveCodArticulo(item.product_source_id);
    out[item.id] = await quoteUnitPrice(cod, order.customer_id);
  }
  return out;
}
