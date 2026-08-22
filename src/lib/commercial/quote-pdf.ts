import PDFDocument from "pdfkit";
import { randomUUID } from "node:crypto";
import { createCommercialAdminClient } from "@/lib/supabase/commercial/admin";
import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import { getCommercialSession } from "@/lib/commercial/session";
import { requireStaffSession } from "@/lib/commercial/backoffice";

export function normalizeArWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits.startsWith("54")) {
    if (digits.startsWith("0")) digits = digits.slice(1);
    digits = `54${digits}`;
  }
  // AR mobile: 54 9 area…
  if (digits.startsWith("54") && !digits.startsWith("549") && digits.length >= 12) {
    digits = `549${digits.slice(2)}`;
  }
  if (digits.length < 11) return null;
  return digits;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

function money(n: number): string {
  return `USD ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function generateAndStoreQuotePdf(orderId: string): Promise<{
  pdfUrl: string;
  path: string;
}> {
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  const supabase = await createCommercialServerClient();
  const admin = createCommercialAdminClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      id, order_number, status, customer_id, quote_valid_until, created_at, submitted_at,
      customers ( legal_name, trade_name, cuit, phone ),
      order_items (
        id, product_source_id, product_name_snapshot, sku_snapshot, quantity, unit_price_snapshot
      )
    `,
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (!["quoted", "sent"].includes(order.status)) throw new Error("ORDER_NOT_QUOTED");

  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const codes = items.map((i) => i.sku_snapshot || i.product_source_id);

  const { data: tango } = await supabase
    .from("products_tango")
    .select("cod_articulo, image_url")
    .in("cod_articulo", codes);
  const imgByCode = new Map((tango ?? []).map((t) => [t.cod_articulo, t.image_url]));

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = 40;
  const pageBottom = 780;

  doc.fontSize(20).fillColor("#006A46").text("Sure Rain", left, 40);
  doc.fontSize(14).fillColor("#111").text("Cotización", left, 68);
  doc.fontSize(10).fillColor("#444");
  doc.text(`N° ${order.order_number}`, left, 90);
  doc.text(
    `Fecha: ${new Date(order.submitted_at ?? order.created_at).toLocaleDateString("es-AR")}`,
    left,
    104,
  );
  if (order.quote_valid_until) {
    doc.text(
      `Validez: ${new Date(order.quote_valid_until).toLocaleDateString("es-AR")}`,
      left,
      118,
    );
  }

  let y = 150;
  doc.fontSize(11).fillColor("#111").text("Cliente", left, y);
  y += 16;
  doc.fontSize(10).fillColor("#333");
  doc.text(customer?.trade_name || customer?.legal_name || order.customer_id, left, y);
  y += 14;
  if (customer?.legal_name && customer.trade_name) {
    doc.text(customer.legal_name, left, y);
    y += 14;
  }
  if (customer?.cuit) {
    doc.text(`CUIT: ${customer.cuit}`, left, y);
    y += 14;
  }
  y += 12;

  let total = 0;
  for (const item of items) {
    if (y > pageBottom - 90) {
      doc.addPage();
      y = 40;
    }
    const qty = Number(item.quantity);
    const unit = item.unit_price_snapshot == null ? null : Number(item.unit_price_snapshot);
    const sub = unit == null ? null : unit * qty;
    if (sub != null) total += sub;
    const code = item.sku_snapshot || item.product_source_id;

    const imageUrl = imgByCode.get(code) ?? null;
    let drew = false;
    if (imageUrl) {
      const buf = await fetchImageBuffer(imageUrl);
      if (buf) {
        try {
          doc.image(buf, left, y, { fit: [52, 52] });
          drew = true;
        } catch {
          drew = false;
        }
      }
    }
    if (!drew) {
      doc.rect(left, y, 52, 52).stroke("#cccccc");
      doc.fontSize(8).fillColor("#999").text("Sure Rain", left + 6, y + 20, {
        width: 40,
        align: "center",
      });
    }

    const tx = left + 64;
    doc.fontSize(10).fillColor("#111").text(item.product_name_snapshot, tx, y, {
      width: 320,
    });
    let ty = doc.y;
    doc.fontSize(8).fillColor("#666").text(code, tx, ty, { width: 320 });
    ty = doc.y + 2;
    doc.fontSize(9).fillColor("#111");
    doc.text(`Cantidad: ${qty}`, tx, ty);
    ty = doc.y;
    doc.text(
      unit == null ? "Precio: —" : `Unit: ${money(unit)}  ·  Subtotal: ${money(sub!)}`,
      tx,
      ty,
    );
    y = Math.max(y + 60, doc.y + 10);
  }

  if (y > pageBottom - 40) {
    doc.addPage();
    y = 40;
  }
  doc.fontSize(13).fillColor("#006A46").text(`Total: ${money(total)}`, left, y + 8, {
    align: "right",
    width: 515,
  });
  doc
    .fontSize(8)
    .fillColor("#888")
    .text("Precios en USD. Cotización generada desde el portal Sure Rain.", left, y + 28);

  doc.end();
  const pdfBuffer = await done;

  const path = `${order.id}/${randomUUID()}.pdf`;
  const { error: upErr } = await admin.storage.from("cotizaciones").upload(path, pdfBuffer, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) throw new Error(upErr.message);

  const { data: pub } = admin.storage.from("cotizaciones").getPublicUrl(path);
  const pdfUrl = pub.publicUrl;

  const { error: updErr } = await admin
    .from("orders")
    .update({ pdf_url: pdfUrl })
    .eq("id", order.id);
  if (updErr) throw new Error(updErr.message);

  await admin.from("audit_log").insert({
    actor_user_id: staff.user.id,
    action: "quote_pdf",
    entity_type: "order",
    entity_id: order.id,
    before: null,
    after: { pdf_url: pdfUrl, path },
  });

  return { pdfUrl, path };
}

export async function markQuoteSent(input: {
  orderId: string;
  phone?: string | null;
}): Promise<{ pdfUrl: string; waUrl: string; phone: string }> {
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  const supabase = await createCommercialServerClient();
  const admin = createCommercialAdminClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      id, order_number, status, pdf_url, whatsapp_phone, customer_id,
      customers ( phone, legal_name, trade_name )
    `,
    )
    .eq("id", input.orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new Error("ORDER_NOT_FOUND");

  let pdfUrl = order.pdf_url;
  if (!pdfUrl || order.status === "quoted") {
    const gen = await generateAndStoreQuotePdf(order.id);
    pdfUrl = gen.pdfUrl;
  }

  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  const phone =
    normalizeArWhatsAppPhone(input.phone) ||
    normalizeArWhatsAppPhone(order.whatsapp_phone) ||
    normalizeArWhatsAppPhone(customer?.phone);
  if (!phone) throw new Error("PHONE_REQUIRED");

  const name = customer?.trade_name || customer?.legal_name || "cliente";
  const text = encodeURIComponent(
    `Hola ${name}, te envío la cotización ${order.order_number} de Sure Rain:\n${pdfUrl}`,
  );
  const waUrl = `https://wa.me/${phone}?text=${text}`;

  const { error: updErr } = await admin
    .from("orders")
    .update({
      status: "sent",
      pdf_url: pdfUrl,
      whatsapp_phone: phone,
    })
    .eq("id", order.id);
  if (updErr) throw new Error(updErr.message);

  if (order.status !== "sent") {
    await admin.from("order_status_history").insert({
      order_id: order.id,
      from_status: order.status,
      to_status: "sent",
      changed_by: staff.user.id,
      comment: `Cotización enviada por WhatsApp (${phone})`,
    });
  }

  return { pdfUrl, waUrl, phone };
}
