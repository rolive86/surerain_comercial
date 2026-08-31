import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { historyEventTitle } from "@/components/OrderTimeline";
import {
  addInternalNoteAction,
  changeOrderStatusAction,
  setOrderItemPriceAction,
  updateOrderQuantitiesAction,
} from "@/lib/commercial/backoffice-actions";
import { saveQuoteAction } from "@/lib/commercial/quote-actions";
import { suggestedPricesForOrder } from "@/lib/commercial/quote";
import { QuoteSendPanel } from "@/components/QuoteSendPanel";
import { StaffStockLine } from "@/components/StockBadges";
import { displayFinalUsd, isValidFinalAmount } from "@/lib/commercial/money";
import { normalizeArWhatsAppPhone } from "@/lib/commercial/phone";
import { getStockAvailabilityMany } from "@/lib/commercial/stock";
import {
  getBackofficeOrderDetail,
  listFilterOptions,
} from "@/lib/commercial/backoffice";
import { getProductCodesBySourceIds } from "@/lib/commercial/product-codes";
import { getProductThumbnailsBySourceIds } from "@/lib/catalog";
import { createCommercialServerClient } from "@/lib/supabase/commercial/server";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const order = await getBackofficeOrderDetail(id);
    return { title: order ? `${order.order_number} · Gestión` : "Pedido" };
  } catch {
    return { title: "Pedido" };
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR");
}

export default async function GestionPedidoDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ error?: string; ok?: string; wa?: string }>;
}) {
  const { id } = await params;
  const flash = await searchParams;
  const [order, options] = await Promise.all([
    getBackofficeOrderDetail(id),
    listFilterOptions(),
  ]);
  if (!order) notFound();

  const supabase = await createCommercialServerClient();
  const [{ data: customerPhone }, { data: pricing }, { data: orderExtra }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("phone")
        .eq("id", order.customer_id)
        .maybeSingle(),
      supabase
        .from("customer_pricing")
        .select("whatsapp_phone")
        .eq("customer_id", order.customer_id)
        .maybeSingle(),
      supabase
        .from("orders")
        .select("pdf_url, whatsapp_phone")
        .eq("id", order.id)
        .maybeSingle(),
    ]);

  const tangoPhone = customerPhone?.phone?.trim() || null;
  const platformPhone = pricing?.whatsapp_phone?.trim() || null;
  const defaultPhone = platformPhone || tangoPhone || null;
  const knownPhones = [
    normalizeArWhatsAppPhone(platformPhone),
    normalizeArWhatsAppPhone(tangoPhone),
  ].filter((p): p is string => Boolean(p));
  // unique
  const knownUnique = [...new Set(knownPhones)];

  const sourceIds = order.items.map((i) => i.product_source_id);
  const [thumbs, codes, suggested] = await Promise.all([
    getProductThumbnailsBySourceIds(sourceIds),
    getProductCodesBySourceIds(sourceIds),
    ["submitted", "quoted", "received"].includes(order.status)
      ? suggestedPricesForOrder(order.id).catch(() => ({} as Record<string, number | null>))
      : Promise.resolve({} as Record<string, number | null>),
  ]);
  const canQuote = ["submitted", "quoted", "received"].includes(order.status);
  const stockCodes = order.items.map(
    (i) => i.sku_snapshot || codes.get(i.product_source_id) || i.product_source_id,
  );
  const stockByCode = await getStockAvailabilityMany(stockCodes);

  return (
    <div>
      <nav className="mb-4 text-sm text-sr-ink/50">
        <Link href="/gestion/pedidos" className="hover:text-sr-green">
          Pedidos
        </Link>
        <span className="mx-2">/</span>
        <span>{order.order_number}</span>
      </nav>

      {flash.error ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {flash.error}
        </p>
      ) : null}
      {flash.ok ? (
        <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {flash.ok === "note"
            ? "Nota interna guardada."
            : flash.ok === "qty"
              ? "Cantidades actualizadas."
              : flash.ok === "price"
                ? "Precio fijado."
                : flash.ok === "prices"
                  ? "Precios guardados (el estado no cambia hasta enviar por WhatsApp)."
                  : flash.ok === "pdf"
                    ? "PDF generado y subido."
                    : flash.ok === "quoted"
                      ? "Cotización enviada (Cotizada). Se abre WhatsApp…"
                      : "Estado actualizado."}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-sr-ink">{order.order_number}</h1>
          <p className="mt-2 text-sm text-sr-ink/60">
            <span className="chip">{order.status_label}</span>
            <span className="ml-2">{order.customer_name}</span>
            {order.sales_rep_name ? (
              <span className="text-sr-ink/45"> · vendedor {order.sales_rep_name}</span>
            ) : null}
          </p>
        </div>
        <p className="text-sm text-sr-ink/50">
          Enviado: {formatDate(order.submitted_at ?? order.created_at)}
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-xl border border-black/5 bg-white p-4 sm:p-5">
          <h2 className="font-display text-lg font-semibold">Ítems</h2>
          <form id="order-qty" action={updateOrderQuantitiesAction}>
            <input type="hidden" name="order_id" value={order.id} />
          </form>
          <ul className="mt-3 divide-y divide-black/5">
            {order.items.map((item) => {
              const thumb = thumbs.get(item.product_source_id);
              const tangoCode = item.sku_snapshot || codes.get(item.product_source_id) || null;
              const priced = isValidFinalAmount(item.unit_price_snapshot);
              return (
                <li key={item.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center">
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-sr-mist">
                    {thumb?.url ? (
                      <Image
                        src={thumb.url}
                        alt={item.product_name_snapshot}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.product_name_snapshot}</p>
                    {tangoCode ? (
                      <p className="font-mono text-xs text-sr-ink/55">{tangoCode}</p>
                    ) : (
                      <p className="text-xs text-sr-ink/40">Sin código Tango mapeado</p>
                    )}
                    {priced ? (
                      <p className="mt-1 text-sm font-semibold text-sr-green">
                        {displayFinalUsd(item.unit_price_snapshot)}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-semibold text-amber-800">Precio a confirmar</p>
                    )}
                  </div>
                  {order.status_is_terminal ? (
                    <p className="font-semibold">× {item.quantity}</p>
                  ) : (
                    <label className="shrink-0 text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
                      Cant.
                      <input
                        form="order-qty"
                        type="number"
                        name={`qty_${item.id}`}
                        min={1}
                        step={1}
                        defaultValue={item.quantity}
                        required
                        className="ml-2 min-h-11 w-24 rounded-md border border-black/10 px-2 py-1.5 text-sm font-normal normal-case tracking-normal"
                      />
                    </label>
                  )}
                  {!priced && !order.status_is_terminal ? (
                    <form action={setOrderItemPriceAction} className="flex w-full shrink-0 flex-wrap items-end gap-2 sm:w-auto">
                      <input type="hidden" name="order_id" value={order.id} />
                      <input type="hidden" name="item_id" value={item.id} />
                      <label className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
                        USD
                        <input
                          name="amount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          className="ml-2 min-h-11 w-28 rounded-md border border-black/10 px-2 py-1.5 text-sm font-normal normal-case tracking-normal"
                        />
                      </label>
                      <button type="submit" className="btn-secondary !min-h-11 px-4 text-sm">
                        Fijar
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {!order.status_is_terminal ? (
            <button type="submit" form="order-qty" className="btn-primary mt-4">
              Guardar cantidades
            </button>
          ) : null}
        </section>

        {canQuote ? (
          <section className="rounded-xl border border-sr-green/20 bg-white p-5 lg:col-span-2">
            <h2 className="font-display text-lg font-semibold text-sr-ink">
              Cotizar solicitud
            </h2>
            <p className="mt-1 text-sm text-sr-ink/55">
              Precios sugeridos = base × (1 + markup del cliente). Editá si hace falta y guardá.
            </p>
            <form action={saveQuoteAction} className="mt-4 space-y-3">
              <input type="hidden" name="order_id" value={order.id} />
              <ul className="divide-y divide-black/5 rounded-lg border border-black/5">
                {order.items.map((item) => {
                  const suggestedAmt =
                    suggested[item.id] ?? item.unit_price_snapshot ?? "";
                  const code =
                    item.sku_snapshot ||
                    codes.get(item.product_source_id) ||
                    item.product_source_id;
                  const stock = stockByCode.get(code);
                  return (
                    <li
                      key={item.id}
                      className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{item.product_name_snapshot}</p>
                        <p className="text-xs text-sr-ink/50">
                          × {item.quantity}
                          {code ? ` · ${code}` : ""}
                        </p>
                        {stock ? (
                          <StaffStockLine
                            stockReal={stock.stock_real}
                            comprometido={stock.comprometido}
                            libre={stock.libre}
                            compact
                          />
                        ) : null}
                      </div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
                        USD unit.
                        <input
                          name={`price_${item.id}`}
                          type="number"
                          min={0}
                          step="0.01"
                          defaultValue={suggestedAmt === null ? "" : suggestedAmt}
                          className="ml-2 min-h-11 w-28 rounded-md border border-black/10 px-2 py-1.5 text-sm font-normal normal-case tracking-normal"
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
              <button type="submit" className="btn-primary">
                Guardar cotización
              </button>
            </form>
          </section>
        ) : null}

        <div className="lg:col-span-2">
          <QuoteSendPanel
            orderId={order.id}
            status={order.status}
            pdfUrl={orderExtra?.pdf_url ?? null}
            defaultPhone={defaultPhone}
            knownPhones={knownUnique}
            waUrl={flash.wa ? decodeURIComponent(flash.wa) : null}
          />
        </div>

        <section className="rounded-xl border border-black/5 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Cambiar estado</h2>
          <form action={changeOrderStatusAction} className="mt-3 space-y-3">
            <input type="hidden" name="order_id" value={order.id} />
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Nuevo estado
              <select
                name="to_status"
                required
                defaultValue=""
                className="mt-1 w-full rounded-md border border-black/10 px-2 py-2 text-sm font-normal normal-case tracking-normal"
              >
                <option value="" disabled>
                  Seleccionar…
                </option>
                {options.statuses
                  .filter((s) => s.code !== order.status)
                  .map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Comentario (opcional)
              <textarea
                name="comment"
                rows={2}
                className="mt-1 w-full rounded-md border border-black/10 px-2 py-2 text-sm font-normal normal-case tracking-normal"
              />
            </label>
            <button type="submit" className="btn-primary w-full">
              Guardar cambio
            </button>
          </form>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-black/5 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Historial</h2>
          <ol className="mt-3 space-y-3 border-l border-sr-green/20 pl-4">
            {order.history.map((h) => (
              <li key={h.id} className="relative text-sm">
                <span className="absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full bg-sr-green" />
                <p className="font-semibold text-sr-ink">{historyEventTitle(h)}</p>
                <p className="text-xs text-sr-ink/40">{formatDate(h.created_at)}</p>
                {h.comment ? (
                  <p className="mt-1 whitespace-pre-wrap text-sr-ink/60">{h.comment}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl border border-black/5 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Notas</h2>
          <ul className="mt-3 space-y-2">
            {order.notes.length === 0 ? (
              <li className="text-sm text-sr-ink/45">Sin notas.</li>
            ) : (
              order.notes.map((n) => (
                <li key={n.id} className="rounded-md bg-sr-mist/60 px-3 py-2 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-sr-ink/40">
                    {n.note_type === "internal" ? "Interna" : "Cliente"}
                  </p>
                  <p className="mt-1 text-sr-ink/75">{n.body}</p>
                </li>
              ))
            )}
          </ul>
          <form action={addInternalNoteAction} className="mt-4 space-y-2 border-t border-black/5 pt-4">
            <input type="hidden" name="order_id" value={order.id} />
            <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
              Nota interna
              <textarea
                name="body"
                required
                rows={2}
                className="mt-1 w-full rounded-md border border-black/10 px-2 py-2 text-sm font-normal normal-case tracking-normal"
              />
            </label>
            <button type="submit" className="btn-secondary">
              Agregar nota interna
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
