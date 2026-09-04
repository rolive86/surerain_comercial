"use client";

import { useState, useTransition } from "react";
import { previewMarginImpactAction, upsertMarginAction } from "@/lib/commercial/admin-actions";
import { formatFinalUsd } from "@/lib/commercial/money";
import type { MarginPreview } from "@/lib/commercial/admin-types";

export function MarginEditor({
  id,
  scope,
  percent,
  category,
  customers,
  families,
  submitLabel,
}: {
  id?: string;
  scope: "global" | "category" | "product" | "customer";
  percent?: number;
  category?: string | null;
  customers: Array<{ id: string; legal_name: string; trade_name: string | null }>;
  families: string[];
  submitLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<MarginPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [percentValue, setPercentValue] = useState(String(percent ?? (scope === "global" ? 35 : "")));
  const pct = Number(String(percentValue).replace(",", "."));
  const extreme = Number.isFinite(pct) && (pct < 0 || pct > 100);

  function runPreview(form: HTMLFormElement) {
    const data = new FormData(form);
    setError(null);
    startTransition(async () => {
      const result = await previewMarginImpactAction(data);
      if (result.error) {
        setPreview(null);
        setError(result.error);
        return;
      }
      setPreview(result.preview);
    });
  }

  return (
    <form
      action={upsertMarginAction}
      className={scope === "global" ? "mt-4 flex flex-wrap items-end gap-3" : "mt-4 grid gap-3 sm:grid-cols-2"}
      onSubmit={(e) => {
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.name === "intent" && submitter.value === "preview") {
          e.preventDefault();
          runPreview(e.currentTarget);
        }
      }}
    >
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {scope === "global" ? (
        <input type="hidden" name="scope" value="global" />
      ) : (
        <label className="text-sm font-semibold">
          Alcance
          <select name="scope" defaultValue={scope} className="mt-1 w-full rounded-md border border-black/10 px-3 py-2">
            <option value="category">Categoría / familia</option>
            <option value="product">Producto (cod Tango)</option>
            <option value="customer">Cliente</option>
          </select>
        </label>
      )}
      <label className="text-sm font-semibold text-sr-ink/70">
        %
        <input
          name="percent"
          type="number"
          step="0.1"
          min={-100}
          max={500}
          value={percentValue}
          onChange={(e) => {
            setPercentValue(e.target.value);
            setPreview(null);
          }}
          className={scope === "global" ? "ml-2 w-28 rounded-md border border-black/10 px-3 py-2" : "mt-1 w-full rounded-md border border-black/10 px-3 py-2"}
          required
        />
      </label>
      {scope !== "global" ? (
        <>
          <label className="text-sm font-semibold">
            Familia Tango
            <select name="category" defaultValue={category ?? ""} className="mt-1 w-full rounded-md border border-black/10 px-3 py-2">
              <option value="">—</option>
              {families.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Código Tango
            <input
              name="cod_articulo"
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Cliente
            <select name="customer_id" className="mt-1 w-full rounded-md border border-black/10 px-3 py-2">
              <option value="">—</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.trade_name || c.legal_name}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
      {extreme ? (
        <label className={`flex items-center gap-2 text-sm text-amber-900 ${scope === "global" ? "w-full" : "sm:col-span-2"}`}>
          <input type="checkbox" name="confirm_extreme" required />
          Confirmo margen excepcional ({pct}%)
        </label>
      ) : null}
      {error ? (
        <p className={`text-sm text-red-700 ${scope === "global" ? "w-full" : "sm:col-span-2"}`}>{error}</p>
      ) : null}
      {preview ? (
        <div className={`rounded-md bg-sr-mist/70 px-3 py-2 text-sm ${scope === "global" ? "w-full" : "sm:col-span-2"}`}>
          <p className="font-semibold">
            {preview.note ?? `Afecta ${preview.count} producto(s) con precio base.`}
          </p>
          {preview.examples.length ? (
            <ul className="mt-2 space-y-1 text-sr-ink/70">
              {preview.examples.map((ex) => (
                <li key={ex.cod_articulo} className="font-mono text-xs">
                  {ex.cod_articulo} {ex.descripcion ? `· ${ex.descripcion}` : ""} · {formatFinalUsd(ex.base)} →{" "}
                  {formatFinalUsd(ex.final)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className={`flex flex-wrap gap-2 ${scope === "global" ? "" : "sm:col-span-2"}`}>
        <button type="submit" name="intent" value="preview" className="btn-secondary" disabled={pending}>
          {pending ? "Calculando…" : "Previsualizar impacto"}
        </button>
        <button type="submit" className="btn-primary" disabled={!preview || pending}>
          {submitLabel}
        </button>
      </div>
      {!preview ? (
        <p className={`text-xs text-sr-ink/45 ${scope === "global" ? "w-full" : "sm:col-span-2"}`}>
          Previsualizá el impacto antes de guardar.
        </p>
      ) : null}
    </form>
  );
}
