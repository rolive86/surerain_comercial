"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createCommercialBrowserClient } from "@/lib/supabase/commercial/client";
import { saveFacturaAction } from "@/lib/commercial/facturas-actions";
import type { CentroCosto, MotivoFactura } from "@/lib/commercial/facturas";

type Step = "list" | "capture" | "review" | "meta";

type OcrResult = {
  monto: number | null;
  fecha: string | null;
  cuit: string | null;
  qr_afip?: string | null;
  notes?: string;
  ocr_available?: boolean;
};

export function FacturasClient({
  facturas,
  centros,
  motivos,
  userId,
}: {
  facturas: Array<{
    id: string;
    tipo: string | null;
    monto: number | null;
    fecha: string | null;
    estado: string;
    created_at: string;
  }>;
  centros: CentroCosto[];
  motivos: MotivoFactura[];
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
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState("");
  const [cuit, setCuit] = useState("");
  const [tipo, setTipo] = useState<"gasto" | "venta">("gasto");
  const [centroId, setCentroId] = useState(centros[0]?.id ?? "");
  const [motivoId, setMotivoId] = useState(motivos[0]?.id ?? "");

  const defaultCentro = useMemo(
    () => centros.find((c) => c.nombre === "Sin centro")?.id ?? centros[0]?.id ?? "",
    [centros],
  );

  function resetFlow() {
    setStep("list");
    setError(null);
    setPreviewUrl(null);
    setFile(null);
    setImagePath(null);
    setOcr(null);
    setMonto("");
    setFecha("");
    setCuit("");
    setTipo("gasto");
    setCentroId(defaultCentro);
    setMotivoId(motivos[0]?.id ?? "");
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
      const res = await fetch("/api/facturas/ocr", { method: "POST", body: fd });
      const data = (await res.json()) as OcrResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "OCR falló");
      setOcr(data);
      setMonto(data.monto != null ? String(data.monto) : "");
      setFecha(data.fecha ?? "");
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
      .from("facturas")
      .upload(path, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setImagePath(path);
    if (!centroId) setCentroId(defaultCentro);
    setStep("meta");
  }

  function confirmSave() {
    if (!imagePath) return;
    const montoNum = monto.trim() ? Number(monto.replace(",", ".")) : null;
    startTransition(async () => {
      const result = await saveFacturaAction({
        imagePath,
        tipo,
        centroCostoId: centroId || defaultCentro,
        motivoId,
        monto: Number.isFinite(montoNum as number) ? montoNum : null,
        fecha: fecha.trim() || null,
        cuit: cuit.trim() || null,
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
            <h2 className="font-display text-lg font-bold">Subir factura</h2>
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
                alt="Factura"
                className="max-h-56 w-full rounded-xl object-contain bg-sr-mist"
              />
            ) : null}
            {ocr?.notes ? (
              <p className="text-[12px] text-sr-ink/50">{ocr.notes}</p>
            ) : null}
            <Field label="Monto (ARS)">
              <input
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                inputMode="decimal"
                className="min-h-11 w-full rounded-xl border border-sr-ink/15 px-3"
              />
            </Field>
            <Field label="Fecha">
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-sr-ink/15 px-3"
              />
            </Field>
            <Field label="CUIT">
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
            <h2 className="font-display text-lg font-bold">Clasificar</h2>
            <Field label="Tipo">
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as "gasto" | "venta")}
                className="min-h-11 w-full rounded-xl border border-sr-ink/15 px-3"
              >
                <option value="gasto">Gasto</option>
                <option value="venta">Venta</option>
              </select>
            </Field>
            <Field label="Centro de costos">
              <select
                value={centroId}
                onChange={(e) => setCentroId(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-sr-ink/15 px-3"
              >
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-sr-ink/40">
                Lista provisional — faltan centros del cliente
              </p>
            </Field>
            <Field label="Motivo">
              <select
                value={motivoId}
                onChange={(e) => setMotivoId(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-sr-ink/15 px-3"
              >
                {motivos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              disabled={pending}
              onClick={confirmSave}
              className="min-h-11 w-full rounded-xl bg-sr-green text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar factura"}
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => {
          setCentroId(defaultCentro);
          setStep("capture");
        }}
        className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-sr-green text-base font-semibold text-white shadow-sm"
      >
        + Subir Factura
      </button>

      {!facturas.length ? (
        <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-sr-ink/50">
          Todavía no subiste facturas.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-sr-mist bg-white divide-y divide-sr-mist">
          {facturas.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold capitalize text-sr-ink">
                  {f.tipo ?? "—"} · {f.estado}
                </p>
                <p className="text-[12px] text-sr-ink/45">
                  {f.fecha ?? f.created_at.slice(0, 10)}
                </p>
              </div>
              <p className="shrink-0 font-display text-lg font-bold tabular-nums text-sr-green">
                {f.monto == null
                  ? "—"
                  : f.monto.toLocaleString("es-AR", {
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
