"use client";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  disabled = false,
  id,
  label = "Cantidad",
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  disabled?: boolean;
  id?: string;
  label?: string;
}) {
  const set = (n: number) => {
    const next = Number.isFinite(n) ? Math.max(min, Math.trunc(n)) : min;
    onChange(next);
  };

  return (
    <div className="inline-flex items-center rounded-xl border border-black/10 bg-white">
      <button
        type="button"
        aria-label="Disminuir cantidad"
        disabled={disabled || value <= min}
        onClick={() => set(value - 1)}
        className="flex h-11 w-11 items-center justify-center text-lg font-semibold text-sr-ink disabled:opacity-30"
      >
        −
      </button>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        value={value}
        disabled={disabled}
        onChange={(e) => set(Number(e.target.value))}
        className="h-11 w-12 border-x border-black/10 bg-transparent text-center text-sm font-semibold outline-none"
      />
      <button
        type="button"
        aria-label="Aumentar cantidad"
        disabled={disabled}
        onClick={() => set(value + 1)}
        className="flex h-11 w-11 items-center justify-center text-lg font-semibold text-sr-ink disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
