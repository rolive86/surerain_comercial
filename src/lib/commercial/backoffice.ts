import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { createCommercialAdminClient } from "@/lib/supabase/commercial/admin";
import { getCommercialSession, type CommercialSession } from "@/lib/commercial/session";
import { displayFinalUsd, isValidFinalAmount } from "@/lib/commercial/money";

const STAFF_ROLES = new Set(["sales_rep", "sales_manager", "operations", "admin"]);

export function requireStaffSession(
  session: CommercialSession | null,
): CommercialSession {
  if (!session) throw new Error("AUTH_REQUIRED");
  if (!session.claims.app_role || !STAFF_ROLES.has(session.claims.app_role)) {
    throw new Error("STAFF_REQUIRED");
  }
  return session;
}

export function requireAdminConsoleSession(
  session: CommercialSession | null,
): CommercialSession {
  const staff = requireStaffSession(session);
  if (staff.claims.app_role !== "admin" && staff.claims.app_role !== "sales_manager") {
    throw new Error("ADMIN_CONSOLE_REQUIRED");
  }
  return staff;
}

export type BackofficeOrderFilters = {
  q?: string;
  status?: string;
  customerId?: string;
  salesRepId?: string;
  from?: string;
  to?: string;
};

export type BackofficeOrderListItem = {
  id: string;
  order_number: string;
  status: string;
  status_label: string;
  submitted_at: string | null;
  created_at: string;
  customer_id: string;
  customer_name: string;
  sales_rep_id: string | null;
  sales_rep_name: string | null;
  item_count: number;
};

export type BackofficeOrderDetail = BackofficeOrderListItem & {
  status_is_terminal: boolean;
  items: Array<{
    id: string;
    product_source_id: string;
    product_name_snapshot: string;
    product_slug_snapshot: string | null;
    sku_snapshot: string | null;
    quantity: number;
    unit_price_snapshot: number | null;
  }>;
  history: Array<{
    id: string;
    from_status: string | null;
    to_status: string;
    to_status_label: string;
    comment: string | null;
    created_at: string;
    changed_by: string | null;
  }>;
  notes: Array<{
    id: string;
    note_type: string;
    body: string;
    created_at: string;
  }>;
};

async function statusMap() {
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("order_statuses")
    .select("code, label")
    .eq("active", true);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((s) => [s.code, s.label]));
}

export async function listBackofficeOrders(
  filters: BackofficeOrderFilters = {},
): Promise<BackofficeOrderListItem[]> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();
  const labels = await statusMap();

  let query = supabase
    .from("orders")
    .select(
      `
      id, order_number, status, submitted_at, created_at, customer_id, sales_rep_id,
      customers ( legal_name, trade_name ),
      sales_reps ( name ),
      order_items ( id )
    `,
    )
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.customerId) query = query.eq("customer_id", filters.customerId);
  if (filters.salesRepId) query = query.eq("sales_rep_id", filters.salesRepId);
  if (filters.q) query = query.ilike("order_number", `%${filters.q}%`);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    const rep = Array.isArray(row.sales_reps) ? row.sales_reps[0] : row.sales_reps;
    const items = Array.isArray(row.order_items) ? row.order_items : [];
    return {
      id: row.id,
      order_number: row.order_number,
      status: row.status,
      status_label: labels.get(row.status) ?? row.status,
      submitted_at: row.submitted_at,
      created_at: row.created_at,
      customer_id: row.customer_id,
      customer_name: customer?.trade_name || customer?.legal_name || row.customer_id,
      sales_rep_id: row.sales_rep_id,
      sales_rep_name: rep?.name ?? null,
      item_count: items.length,
    };
  });
}

export async function getBackofficeOrderDetail(
  orderId: string,
): Promise<BackofficeOrderDetail | null> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();
  const labels = await statusMap();

  const { data: row, error } = await supabase
    .from("orders")
    .select(
      `
      id, order_number, status, submitted_at, created_at, customer_id, sales_rep_id,
      customers ( legal_name, trade_name ),
      sales_reps ( name ),
      order_items (
        id, product_source_id, product_name_snapshot, product_slug_snapshot,
        sku_snapshot, quantity, unit_price_snapshot
      ),
      order_status_history (
        id, from_status, to_status, comment, created_at, changed_by
      ),
      order_notes (
        id, note_type, body, created_at
      )
    `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return null;

  const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
  const rep = Array.isArray(row.sales_reps) ? row.sales_reps[0] : row.sales_reps;
  const items = (Array.isArray(row.order_items) ? row.order_items : []).map((i) => ({
    ...i,
    quantity: Number(i.quantity),
    unit_price_snapshot:
      i.unit_price_snapshot == null ? null : Number(i.unit_price_snapshot),
  }));
  const history = (Array.isArray(row.order_status_history) ? row.order_status_history : [])
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((h) => ({
      id: h.id,
      from_status: h.from_status,
      to_status: h.to_status,
      to_status_label: labels.get(h.to_status) ?? h.to_status,
      comment: h.comment,
      created_at: h.created_at,
      changed_by: h.changed_by,
    }));
  const notes = Array.isArray(row.order_notes) ? row.order_notes : [];

  const { data: statusMeta } = await supabase
    .from("order_statuses")
    .select("is_terminal")
    .eq("code", row.status)
    .maybeSingle();

  return {
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    status_is_terminal: Boolean(statusMeta?.is_terminal),
    status_label: labels.get(row.status) ?? row.status,
    submitted_at: row.submitted_at,
    created_at: row.created_at,
    customer_id: row.customer_id,
    customer_name: customer?.trade_name || customer?.legal_name || row.customer_id,
    sales_rep_id: row.sales_rep_id,
    sales_rep_name: rep?.name ?? null,
    item_count: items.length,
    items,
    history,
    notes,
  };
}

export async function changeOrderStatus(input: {
  orderId: string;
  toStatus: string;
  comment?: string;
}): Promise<void> {
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  const supabase = await createCommercialServerClient();

  const { data: order, error: findErr } = await supabase
    .from("orders")
    .select("id, status, order_number")
    .eq("id", input.orderId)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.status === input.toStatus) throw new Error("STATUS_UNCHANGED");

  const { data: statusRow, error: stErr } = await supabase
    .from("order_statuses")
    .select("code, active")
    .eq("code", input.toStatus)
    .maybeSingle();
  if (stErr) throw new Error(stErr.message);
  if (!statusRow?.active) throw new Error("INVALID_STATUS");

  const fromStatus = order.status;

  const { error: updErr } = await supabase
    .from("orders")
    .update({ status: input.toStatus })
    .eq("id", order.id);
  if (updErr) throw new Error(updErr.message);

  const { error: histErr } = await supabase.from("order_status_history").insert({
    order_id: order.id,
    from_status: fromStatus,
    to_status: input.toStatus,
    changed_by: staff.user.id,
    comment: input.comment?.trim() || null,
  });
  if (histErr) throw new Error(histErr.message);

  const { error: auditErr } = await supabase.from("audit_log").insert({
    actor_user_id: staff.user.id,
    action: "status_change",
    entity_type: "order",
    entity_id: order.id,
    before: { status: fromStatus, order_number: order.order_number },
    after: { status: input.toStatus, order_number: order.order_number },
  });
  if (auditErr) throw new Error(auditErr.message);
}

export async function updateOrderItemQuantities(
  orderId: string,
  quantities: Record<string, number>,
): Promise<void> {
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  const supabase = await createCommercialServerClient();

  const { data: order, error: findErr } = await supabase
    .from("orders")
    .select("id, status, order_number")
    .eq("id", orderId)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const { data: statusMeta, error: stErr } = await supabase
    .from("order_statuses")
    .select("is_terminal")
    .eq("code", order.status)
    .maybeSingle();
  if (stErr) throw new Error(stErr.message);
  if (statusMeta?.is_terminal) throw new Error("ORDER_LOCKED");

  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("id, product_name_snapshot, quantity")
    .eq("order_id", order.id);
  if (itemsErr) throw new Error(itemsErr.message);

  const changes: Array<{
    id: string;
    name: string;
    fromQty: number;
    toQty: number;
  }> = [];

  for (const item of items ?? []) {
    const raw = quantities[item.id];
    if (raw === undefined) continue;
    const toQty = Math.floor(Number(raw));
    if (!Number.isFinite(toQty) || toQty < 1) throw new Error("INVALID_QUANTITY");
    const fromQty = Number(item.quantity);
    if (toQty === fromQty) continue;
    changes.push({
      id: item.id,
      name: item.product_name_snapshot,
      fromQty,
      toQty,
    });
  }

  if (!changes.length) throw new Error("QUANTITY_UNCHANGED");

  for (const change of changes) {
    const { error: updErr } = await supabase
      .from("order_items")
      .update({ quantity: change.toQty })
      .eq("id", change.id)
      .eq("order_id", order.id);
    if (updErr) throw new Error(updErr.message);
  }

  const comment = changes
    .map((c) => `Cantidad de ${c.name}: ${c.fromQty} → ${c.toQty}`)
    .join("\n");

  const { error: histErr } = await supabase.from("order_status_history").insert({
    order_id: order.id,
    from_status: order.status,
    to_status: order.status,
    changed_by: staff.user.id,
    comment,
  });
  if (histErr) throw new Error(histErr.message);

  const { error: auditErr } = await supabase.from("audit_log").insert({
    actor_user_id: staff.user.id,
    action: "qty_change",
    entity_type: "order",
    entity_id: order.id,
    before: {
      order_number: order.order_number,
      items: changes.map((c) => ({ id: c.id, quantity: c.fromQty })),
    },
    after: {
      order_number: order.order_number,
      items: changes.map((c) => ({ id: c.id, quantity: c.toQty })),
    },
  });
  if (auditErr) throw new Error(auditErr.message);
}

export async function setOrderItemPrice(orderId: string, itemId: string, amount: number): Promise<void> {
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  if (!isValidFinalAmount(amount)) throw new Error("INVALID_PRICE");

  const supabase = await createCommercialServerClient();
  const { data: order, error: findErr } = await supabase
    .from("orders")
    .select("id, status, order_number")
    .eq("id", orderId)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const { data: statusMeta, error: stErr } = await supabase
    .from("order_statuses")
    .select("is_terminal")
    .eq("code", order.status)
    .maybeSingle();
  if (stErr) throw new Error(stErr.message);
  if (statusMeta?.is_terminal) throw new Error("ORDER_LOCKED");

  const { data: item, error: itemErr } = await supabase
    .from("order_items")
    .select("id, product_name_snapshot, unit_price_snapshot")
    .eq("id", itemId)
    .eq("order_id", order.id)
    .maybeSingle();
  if (itemErr) throw new Error(itemErr.message);
  if (!item) throw new Error("ORDER_NOT_FOUND");

  const admin = createCommercialAdminClient();
  const { error: updErr } = await admin
    .from("order_items")
    .update({ unit_price_snapshot: amount })
    .eq("id", item.id)
    .eq("order_id", order.id);
  if (updErr) throw new Error(updErr.message);

  const fromLabel = displayFinalUsd(
    item.unit_price_snapshot == null ? null : Number(item.unit_price_snapshot),
  );
  const comment = `Precio de ${item.product_name_snapshot}: ${fromLabel} → ${displayFinalUsd(amount)}`;

  const { error: histErr } = await supabase.from("order_status_history").insert({
    order_id: order.id,
    from_status: order.status,
    to_status: order.status,
    changed_by: staff.user.id,
    comment,
  });
  if (histErr) throw new Error(histErr.message);

  const { error: auditErr } = await supabase.from("audit_log").insert({
    actor_user_id: staff.user.id,
    action: "price_set",
    entity_type: "order",
    entity_id: order.id,
    before: {
      order_number: order.order_number,
      item_id: item.id,
      unit_price_snapshot: item.unit_price_snapshot,
    },
    after: { order_number: order.order_number, item_id: item.id, unit_price_snapshot: amount },
  });
  if (auditErr) throw new Error(auditErr.message);
}

export async function addInternalOrderNote(orderId: string, body: string): Promise<void> {
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  const note = body.trim();
  if (!note) throw new Error("EMPTY_NOTE");

  const supabase = await createCommercialServerClient();
  const { error } = await supabase.from("order_notes").insert({
    order_id: orderId,
    note_type: "internal",
    body: note,
    author_user_id: staff.user.id,
  });
  if (error) throw new Error(error.message);
}

export async function listFilterOptions() {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();

  const [{ data: customers }, { data: reps }, { data: statuses }] = await Promise.all([
    supabase.from("customers").select("id, legal_name, trade_name").eq("active", true).order("legal_name"),
    supabase.from("sales_reps").select("id, name").eq("active", true).order("name"),
    supabase.from("order_statuses").select("code, label").eq("active", true).order("sort_order"),
  ]);

  return {
    customers: customers ?? [],
    salesReps: reps ?? [],
    statuses: statuses ?? [],
  };
}
