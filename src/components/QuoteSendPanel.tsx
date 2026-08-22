"use client";

import { useEffect, useRef } from "react";
import {
  generateQuotePdfAction,
  sendQuoteWhatsAppAction,
} from "@/lib/commercial/quote-actions";
import { normalizeArWhatsAppPhone } from "@/lib/commercial/phone";

export function QuoteSendPanel({
  orderId,
  status,
  pdfUrl,
  defaultPhone,
  knownPhones,
  waUrl,
}: {
  orderId: string;
  status: string;
  pdfUrl: string | null;
  /** Prefill visible (platform override || tango). Vacío si no hay. */
  defaultPhone: string | null;
  /** Números ya conocidos (normalizados) — no preguntar guardar si coincide. */
  knownPhones: string[];
  waUrl?: string | null;
}) {
  const saveFlagRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (waUrl) {
      window.open(waUrl, "_blank", "noopener,noreferrer");
    }
  }, [waUrl]);

  if (!["quoted", "sent", "submitted", "received"].includes(status)) return null;

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
      <form
        action={sendQuoteWhatsAppAction}
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          const form = e.currentTarget;
          const raw = String(new FormData(form).get("phone") ?? "");
          const entered = normalizeArWhatsAppPhone(raw);
          if (saveFlagRef.current) saveFlagRef.current.value = "";
          if (!entered) return;
          const alreadyKnown = knownPhones.includes(entered);
          if (!alreadyKnown) {
            const ok = window.confirm(
              "¿Agregar este número a los datos del cliente?",
            );
            if (ok && saveFlagRef.current) {
              saveFlagRef.current.value = "1";
            }
          }
        }}
      >
        <input type="hidden" name="order_id" value={orderId} />
        <input ref={saveFlagRef} type="hidden" name="save_phone_to_customer" value="" />
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
