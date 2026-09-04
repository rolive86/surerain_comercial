import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { getCommercialSession } from "@/lib/commercial/session";
import { getProductCodesBySourceIds } from "@/lib/commercial/product-codes";

export type CartItemInput = {
  product_source_id: string;
  product_name_snapshot: string;
  product_slug_snapshot?: string | null;
  quantity?: number;
  unit_snapshot?: string | null;
};

export type CartView = {
  id: string;
  customer_id: string;
  items: Array<{
    id: string;
    product_source_id: string;
    product_name_snapshot: string;
    product_slug_snapshot: string | null;
    quantity: number;
    unit_snapshot: string | null;
    image_url?: string | null;
    image_alt?: string | null;
    unit_price?: number | null;
    tango_code?: string | null;
  }>;
  itemCount: number;
};

function requireCustomerSession(
  session: Awaited<ReturnType<typeof getCommercialSession>>,
): { userId: string; customerId: string } {
  if (!session) {
    throw new Error("AUTH_REQUIRED");
  }
  if (session.claims.app_role !== "customer_user" || !session.claims.customer_id) {
    throw new Error("CUSTOMER_ROLE_REQUIRED");
  }
  return { userId: session.user.id, customerId: session.claims.customer_id };
}

export async function getOrCreateOpenCart(): Promise<CartView> {
  const session = await getCommercialSession();
  const { userId, customerId } = requireCustomerSession(session);
  const supabase = await createCommercialServerClient();

  const { data: existing, error: findErr } = await supabase
    .from("carts")
    .select("id, customer_id")
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);

  let cartId = existing?.id;
  if (!cartId) {
    const { data: created, error: createErr } = await supabase
      .from("carts")
      .insert({ user_id: userId, customer_id: customerId, status: "open" })
      .select("id, customer_id")
      .single();
    if (createErr) throw new Error(createErr.message);
    cartId = created.id;
  }

  return loadCartView(cartId);
}

async function loadCartView(cartId: string): Promise<CartView> {
  const supabase = await createCommercialServerClient();
  const { data: cart, error: cartErr } = await supabase
    .from("carts")
    .select("id, customer_id")
    .eq("id", cartId)
    .single();
  if (cartErr) throw new Error(cartErr.message);

  const { data: items, error: itemsErr } = await supabase
    .from("cart_items")
    .select(
      "id, product_source_id, product_name_snapshot, product_slug_snapshot, quantity, unit_snapshot",
    )
    .eq("cart_id", cartId)
    .order("added_at", { ascending: true });
  if (itemsErr) throw new Error(itemsErr.message);

  const mapped = (items ?? []).map((item) => ({
    ...item,
    quantity: Number(item.quantity),
  }));

  const sourceIds = mapped.map((i) => i.product_source_id);
  const [codes, tangoRows] = await Promise.all([
    getProductCodesBySourceIds(sourceIds),
    (async () => {
      const { data } = await supabase
        .from("products_tango")
        .select("cod_articulo, image_url, descripcion")
        .in("cod_articulo", sourceIds);
      return data ?? [];
    })(),
  ]);
  const tangoByCode = new Map(tangoRows.map((r) => [r.cod_articulo, r]));
  const withMeta = mapped.map((item) => {
    const tango = tangoByCode.get(item.product_source_id);
    return {
      ...item,
      unit_price: null as number | null,
      tango_code:
        codes.get(item.product_source_id) ??
        (tango ? item.product_source_id : null),
      image_url: tango?.image_url ?? null,
      image_alt: tango?.descripcion ?? item.product_name_snapshot,
    };
  });

  return {
    id: cart.id,
    customer_id: cart.customer_id,
    items: withMeta,
    itemCount: withMeta.reduce((sum, item) => sum + Number(item.quantity), 0),
  };
}

export async function getOpenCartOrNull(): Promise<CartView | null> {
  const session = await getCommercialSession();
  if (!session || session.claims.app_role !== "customer_user") return null;
  try {
    return await getOrCreateOpenCart();
  } catch {
    return null;
  }
}

export async function upsertCartItem(input: CartItemInput): Promise<CartView> {
  const cart = await getOrCreateOpenCart();
  const supabase = await createCommercialServerClient();
  const qty = Math.max(1, Number(input.quantity ?? 1));

  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cart.id)
    .eq("product_source_id", input.product_source_id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: Number(existing.quantity) + qty })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("cart_items").insert({
      cart_id: cart.id,
      product_source_id: input.product_source_id,
      product_name_snapshot: input.product_name_snapshot,
      product_slug_snapshot: input.product_slug_snapshot ?? null,
      quantity: qty,
      unit_snapshot: input.unit_snapshot ?? null,
    });
    if (error) throw new Error(error.message);
  }

  await supabase.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cart.id);
  return loadCartView(cart.id);
}

export async function setCartItemQuantity(itemId: string, quantity: number): Promise<CartView> {
  const cart = await getOrCreateOpenCart();
  const supabase = await createCommercialServerClient();
  if (quantity <= 0) {
    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("id", itemId)
      .eq("cart_id", cart.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity })
      .eq("id", itemId)
      .eq("cart_id", cart.id);
    if (error) throw new Error(error.message);
  }
  return loadCartView(cart.id);
}

export async function removeCartItem(itemId: string): Promise<CartView> {
  return setCartItemQuantity(itemId, 0);
}

export async function mergeGuestCartItems(items: CartItemInput[]): Promise<CartView> {
  let cart = await getOrCreateOpenCart();
  for (const item of items) {
    if (!item.product_source_id || !item.product_name_snapshot) continue;
    cart = await upsertCartItem({
      ...item,
      quantity: Math.max(1, Number(item.quantity ?? 1)),
    });
  }
  return cart;
}

export async function confirmOpenCart(customerNote?: string): Promise<{
  orderId: string;
  orderNumber: string;
}> {
  const session = await getCommercialSession();
  const { userId, customerId } = requireCustomerSession(session);
  const supabase = await createCommercialServerClient();
  const cart = await getOrCreateOpenCart();

  if (!cart.items.length) {
    throw new Error("EMPTY_CART");
  }

  const { data: orderNumber, error: numErr } = await supabase.rpc("next_order_number");
  if (numErr || !orderNumber) throw new Error(numErr?.message ?? "ORDER_NUMBER_FAILED");

  // Snapshot assigned sales rep if any
  const { data: csr } = await supabase
    .from("customer_sales_rep")
    .select("sales_rep_id")
    .eq("customer_id", customerId)
    .eq("active", true)
    .is("valid_to", null)
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_id: customerId,
      user_id: userId,
      sales_rep_id: csr?.sales_rep_id ?? null,
      status: "submitted",
      submitted_at: now,
      source: "portal",
    })
    .select("id, order_number")
    .single();
  if (orderErr) throw new Error(orderErr.message);

  const codes = await getProductCodesBySourceIds(
    cart.items.map((item) => item.product_source_id),
  );

  const { error: itemsErr } = await supabase.from("order_items").insert(
    cart.items.map((item) => ({
      order_id: order.id,
      product_source_id: item.product_source_id,
      product_name_snapshot: item.product_name_snapshot,
      product_slug_snapshot: item.product_slug_snapshot,
      sku_snapshot: codes.get(item.product_source_id) ?? null,
      unit_snapshot: item.unit_snapshot,
      quantity: item.quantity,
      unit_price_snapshot: null,
      discount_snapshot: null,
      metadata_snapshot: {},
    })),
  );
  if (itemsErr) throw new Error(itemsErr.message);

  const { error: histErr } = await supabase.from("order_status_history").insert({
    order_id: order.id,
    from_status: null,
    to_status: "submitted",
    changed_by: userId,
    comment: "Solicitud de cotización enviada desde portal",
  });
  if (histErr) throw new Error(histErr.message);

  const note = customerNote?.trim();
  if (note) {
    const { error: noteErr } = await supabase.from("order_notes").insert({
      order_id: order.id,
      note_type: "customer",
      body: note,
      author_user_id: userId,
    });
    if (noteErr) throw new Error(noteErr.message);
  }

  const { error: cartErr } = await supabase
    .from("carts")
    .update({ status: "converted" })
    .eq("id", cart.id)
    .eq("status", "open");
  if (cartErr) throw new Error(cartErr.message);

  return { orderId: order.id, orderNumber: order.order_number };
}

export async function getOrderForCustomer(orderId: string) {
  const session = await getCommercialSession();
  requireCustomerSession(session);
  const supabase = await createCommercialServerClient();

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
  return order;
}
