"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCommercialBrowserClient } from "@/lib/supabase/commercial/client";
import { saveRendicionAction } from "@/lib/commercial/rendiciones-actions";
import type { ConceptoRendicion } from "@/lib/commercial/rendiciones";

type Step = "list" | "capture" | "review" | "meta";

type OcrResult = {
  total: number | null;
  fecha_emision: string | null;
  tipo_comprobante: string | null;
  nro_comprobante: string | null;
  cuit: string | null;
  iva?: Array<{ cod_alicuota: string | null; importe: number | null }>;
  qr_afip?: string | null;
  notes?: string;
  ocr_available?: boolean;
};

export function RendicionClient({
  comprobantes,
  conceptos,
  userId,
}: {
  comprobantes: Array<{
    id: string;
    tipo: string | null;
    total: number | null;
    fecha_emision: string | null;
    estado: string;
    concepto_nombre: string | null;
    created_at: string;
  }>;
  conceptos: ConceptoRendicion[];
  userId: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("list");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [total, setTotal] = useState("");
  const [fecha, setFecha] = useState("");
  const [tipoComp, setTipoComp] = useState("");
  const [nroComp, setNroComp] = useState("");
  const [cuit, setCuit] = useState("");
  const [conceptoId, setConceptoId] = useState(conceptos[0]?.id ?? "");
  const [observaciones, setObservaciones] = useState("");

  function resetFlow() {
    setStep("list");
    setError(null);
    setPreviewUrl(null);
    setFile(null);
    setImagePath(null);
    setOcr(null);
    setTotal("");
    setFecha("");
    setTipoComp("");
    setNroComp("");
    setCuit("");
    setConceptoId(conceptos[0]?.id ?? "");
    setObservaciones("");
  }

  async function onFileChosen(f: File | null) {
    if (!f) return;
    setError(null);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setStep("review");

    const fd = new FormData();
    fd.set("file", f);
    try {
      const res = await fetch("/api/rendicion/ocr", { method: "POST", body: fd });
      const data = (await res.json()) as OcrResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "OCR falló");
      setOcr(data);
      setTotal(data.total != null ? String(data.total) : "");
      setFecha(data.fecha_emision ?? "");
      setTipoComp(data.tipo_comprobante ?? "");
      setNroComp(data.nro_comprobante ?? "");
      setCuit(data.cuit ?? "");
    } catch (e) {
      setOcr(null);
      setError(e instanceof Error ? e.message : "OCR no disponible");
    }
  }

  async function uploadAndContinue() {
    if (!file) return;
    setError(null);
    const supabase = createCommercialBrowserClient();
    const ext =
      file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
      "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("rendiciones")
      .upload(path, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setImagePath(path);
    setStep("meta");
  }

  function confirmSave() {
    if (!imagePath) return;
    if (!conceptoId) {
      setError("Elegí un concepto / motivo");
      return;
    }
    const totalNum = total.trim() ? Number(total.replace(",", ".")) : null;
    startTransition(async () => {
      const result = await saveRendicionAction({
        imagePath,
        total: Number.isFinite(totalNum as number) ? totalNum : null,
        fechaEmision: fecha.trim() || null,
        tipoComprobante: tipoComp.trim() || null,
        nroComprobante: nroComp.trim() || null,
        cuitEmisor: cuit.trim() || null,
        conceptoId,
        observaciones: observaciones.trim() || null,
        iva: ocr?.iva ?? null,
        ocrRaw: ocr as Record<string, unknown> | null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      resetFlow();
      router.refresh();
    });
  }

  const selectedConcepto = conceptos.find((c) => c.id === conceptoId);

  if (step === "capture" || step === "review" || step === "meta") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={resetFlow}
          className="text-sm font-semibold text-sr-green"
        >
          ← Cancelar
        </button>

        {step === "capture" ? (
          <div className="space-y-3 rounded-2xl border border-sr-mist bg-white p-4">
            <h2 className="font-display text-lg font-bold">Rendir comprobante</h2>
            <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-xl bg-sr-green px-4 text-sm font-semibold text-white">
              Abrir cámara
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-xl border border-sr-ink/15 bg-sr-sand px-4 text-sm font-semibold">
              Elegir archivo / foto
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        ) : null}

        {step === "review" ? (
          <div className="space-y-3 rounded-2xl border border-sr-mist bg-white p-4">
            <h2 className="font-display text-lg font-bold">Revisar OCR</h2>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Comprobante"
                className="max-h-56 w-full rounded-xl object-contain bg-sr-mist"
              />
            ) : null}
            {ocr?.notes ? (
              <p className="text-[12px] text-sr-ink/50">{ocr.notes}</p>
            ) : null}
            <Field label="Importe / total (ARS)">
              <input
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                inputMode="decimal"
                className="min-h-11 w-full rounded-xl border border-sr-ink/15 px-3"
              />
            </Field>
            <Field label="Fecha de emisión">
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-sr-ink/15 px-3"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo comprobante">
                <input
                  value={tipoComp}
                  onChange={(e) => setTipoComp(e.target.value)}
                  placeholder="FC / FA…"
                  className="min-h-11 w-full rounded-xl border border-sr-ink/15 px-3"
                />
              </Field>
              <Field label="Nº comprobante">
                <input
                  value={nroComp}
                  onChange={(e) => setNroComp(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-sr-ink/15 px-3"
                />
              </Field>
            </div>
            <Field label="CUIT emisor">
              <input
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                inputMode="numeric"
                className="min-h-11 w-full rounded-xl border border-sr-ink/15 px-3"
              />
            </Field>
            <button
              type="button"
              onClick={() => void uploadAndContinue()}
              className="min-h-11 w-full rounded-xl bg-sr-green text-sm font-semibold text-white"
            >
              Continuar
            </button>
          </div>
        ) : null}

        {step === "meta" ? (
          <div className="space-y-3 rounded-2xl border border-sr-mist bg-white p-4">
            <h2 className="font-display text-lg font-bold">Concepto y notas</h2>
            <Field label="Motivo / concepto">
              <select
                value={conceptoId}
                onChange={(e) => setConceptoId(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-sr-ink/15 px-3"
              >
                {conceptos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                    {c.centro_nombre ? ` · ${c.centro_nombre}` : ""}
                  </option>
                ))}
              </select>
              {selectedConcepto?.centro_nombre ? (
                <p className="mt-1 text-[11px] text-sr-ink/40">
                  Centro: {selectedConcepto.centro_nombre}
                  {selectedConcepto.cod_sector
                    ? ` (${selectedConcepto.cod_sector})`
                    : ""}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-sr-ink/40">
                  Códigos Tango de concepto/sector: Etapa 2
                </p>
              )}
            </Field>
            <Field label="Observaciones">
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-sr-ink/15 px-3 py-2"
              />
            </Field>
            <button
              type="button"
              disabled={pending}
              onClick={confirmSave}
              className="min-h-11 w-full rounded-xl bg-sr-green text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar rendición"}
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setStep("capture")}
        className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-sr-green text-base font-semibold text-white shadow-sm"
      >
        + Rendir comprobante
      </button>

      {!comprobantes.length ? (
        <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-sr-ink/50">
          Todavía no rendiste comprobantes.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-sr-mist bg-white divide-y divide-sr-mist">
          {comprobantes.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 px-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-sr-ink">
                  {c.concepto_nombre ?? "Sin concepto"} · {c.estado}
                </p>
                <p className="text-[12px] text-sr-ink/45">
                  {c.fecha_emision ?? c.created_at.slice(0, 10)}
                </p>
              </div>
              <p className="shrink-0 font-display text-lg font-bold tabular-nums text-sr-green">
                {c.total == null
                  ? "—"
                  : c.total.toLocaleString("es-AR", {
                      style: "currency",
                      currency: "ARS",
                      maximumFractionDigits: 0,
                    })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-[12px] font-semibold text-sr-ink/55">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
