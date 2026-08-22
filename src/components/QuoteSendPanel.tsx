"use client";

import { useEffect } from "react";
import {
  generateQuotePdfAction,
  sendQuoteWhatsAppAction,
} from "@/lib/commercial/quote-actions";

export function QuoteSendPanel({
  orderId,
  status,
  pdfUrl,
  defaultPhone,
  waUrl,
}: {
  orderId: string;
  status: string;
  pdfUrl: string | null;
  defaultPhone: string | null;
  waUrl?: string | null;
}) {
  useEffect(() => {
    if (waUrl) {
      window.open(waUrl, "_blank", "noopener,noreferrer");
    }
  }, [waUrl]);

  if (!["quoted", "sent"].includes(status)) return null;

  return (
    <section className="rounded-xl border border-sr-green/25 bg-white p-5">
      <h2 className="font-display text-lg font-semibold">PDF y WhatsApp</h2>
      <p className="mt-1 text-sm text-sr-ink/55">
        Generá el PDF, subilo a Storage y abrí WhatsApp con el link (wa.me no adjunta
        archivos).
      </p>
      {pdfUrl ? (
        <p className="mt-2 text-sm">
          PDF:{" "}
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-sr-green underline">
            ver cotización
          </a>
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <form action={generateQuotePdfAction}>
          <input type="hidden" name="order_id" value={orderId} />
          <button type="submit" className="btn-secondary">
            {pdfUrl ? "Regenerar PDF" : "Generar PDF"}
          </button>
        </form>
      </div>
      <form action={sendQuoteWhatsAppAction} className="mt-4 space-y-3">
        <input type="hidden" name="order_id" value={orderId} />
        <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
          Teléfono WhatsApp (Argentina)
          <input
            name="phone"
            defaultValue={defaultPhone ?? ""}
            placeholder="11 1234 5678 o +54 9 11…"
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm font-normal normal-case tracking-normal"
          />
        </label>
        <button type="submit" className="btn-primary">
          Enviar cotización por WhatsApp
        </button>
      </form>
    </section>
  );
}
