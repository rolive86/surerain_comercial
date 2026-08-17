import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { getCommercialSession } from "@/lib/commercial/session";

function requireCustomerSession(
  session: Awaited<ReturnType<typeof getCommercialSession>>,
): { userId: string; customerId: string } {
  if (!session) throw new Error("AUTH_REQUIRED");
  if (session.claims.app_role !== "customer_user" || !session.claims.customer_id) {
    throw new Error("CUSTOMER_ROLE_REQUIRED");
  }
  return { userId: session.user.id, customerId: session.claims.customer_id };
}

export type OrderListItem = {
  id: string;
  order_number: string;
  status: string;
  status_label: string;
  submitted_at: string | null;
  created_at: string;
  item_count: number;
  total_quantity: number;
  preview_items: Array<{
    product_source_id: string;
    product_name_snapshot: string;
    quantity: number;
  }>;
};

export type OrderDetail = {
  id: string;
  order_number: string;
  status: string;
  status_label: string;
  submitted_at: string | null;
  created_at: string;
  customer_id: string;
  items: Array<{
    id: string;
    product_source_id: string;
    product_name_snapshot: string;
    product_slug_snapshot: string | null;
    quantity: number;
    unit_snapshot: string | null;
  }>;
  history: Array<{
    id: string;
    from_status: string | null;
    to_status: string;
    to_status_label: string;
    comment: string | null;
    created_at: string;
  }>;
  customer_notes: Array<{
    id: string;
    body: string;
    created_at: string;
  }>;
};

async function loadStatusMap(): Promise<Map<string, string>> {
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("order_statuses")
    .select("code, label")
    .eq("active", true);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((s) => [s.code, s.label]));
}

export async function listCustomerOrders(filters?: {
  status?: string;
  q?: string;
}): Promise<OrderListItem[]> {
  const session = await getCommercialSession();
  requireCustomerSession(session);
  const supabase = await createCommercialServerClient();
  const statusMap = await loadStatusMap();

  let query = supabase
    .from("orders")
    .select(
      `
      id, order_number, status, submitted_at, created_at,
      order_items ( id, quantity, product_source_id, product_name_snapshot )
    `,
    )
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.q?.trim()) {
    query = query.ilike("order_number", `%${filters.q.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const items = Array.isArray(row.order_items) ? row.order_items : [];
    return {
      id: row.id,
      order_number: row.order_number,
      status: row.status,
      status_label: statusMap.get(row.status) ?? row.status,
      submitted_at: row.submitted_at,
      created_at: row.created_at,
      item_count: items.length,
      total_quantity: items.reduce((sum, i) => sum + Number(i.quantity), 0),
      preview_items: items.slice(0, 4).map((i) => ({
        product_source_id: i.product_source_id,
        product_name_snapshot: i.product_name_snapshot,
        quantity: Number(i.quantity),
      })),
    };
  });
}

export async function getCustomerOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const session = await getCommercialSession();
  requireCustomerSession(session);
  const supabase = await createCommercialServerClient();
  const statusMap = await loadStatusMap();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      id, order_number, status, submitted_at, created_at, customer_id,
      order_items (
        id, product_source_id, product_name_snapshot, product_slug_snapshot,
        quantity, unit_snapshot
      ),
      order_status_history (
        id, from_status, to_status, comment, created_at
      ),
      order_notes (
        id, note_type, body, created_at
      )
    `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!order) return null;

  const items = (Array.isArray(order.order_items) ? order.order_items : []).map((item) => ({
    ...item,
    quantity: Number(item.quantity),
  }));

  const history = (Array.isArray(order.order_status_history) ? order.order_status_history : [])
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((h) => ({
      id: h.id,
      from_status: h.from_status,
      to_status: h.to_status,
      to_status_label: statusMap.get(h.to_status) ?? h.to_status,
      comment: h.comment,
      created_at: h.created_at,
    }));

  const customer_notes = (Array.isArray(order.order_notes) ? order.order_notes : [])
    .filter((n) => n.note_type === "customer")
    .map((n) => ({ id: n.id, body: n.body, created_at: n.created_at }));

  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    status_label: statusMap.get(order.status) ?? order.status,
    submitted_at: order.submitted_at,
    created_at: order.created_at,
    customer_id: order.customer_id,
    items,
    history,
    customer_notes,
  };
}

export async function listActiveOrderStatuses(): Promise<Array<{ code: string; label: string }>> {
  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("order_statuses")
    .select("code, label")
    .eq("active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}
