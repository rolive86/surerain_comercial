"use client";

import { useState, useTransition } from "react";
import { createCommercialBrowserClient } from "@/lib/supabase/commercial/client";

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        setError(null);
        const fd = new FormData(e.currentTarget);
        const password = String(fd.get("password") ?? "");
        const confirm = String(fd.get("confirm") ?? "");
        if (password.length < 8) {
          setError("Mínimo 8 caracteres.");
          return;
        }
        if (password !== confirm) {
          setError("Las contraseñas no coinciden.");
          return;
        }
        startTransition(async () => {
          const supabase = createCommercialBrowserClient();
          const { error: err } = await supabase.auth.updateUser({ password });
          if (err) setError(err.message);
          else {
            setMessage("Contraseña actualizada.");
            e.currentTarget.reset();
          }
        });
      }}
      className="space-y-3"
    >
      <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
        Nueva contraseña
        <input
          type="password"
          name="password"
          required
          minLength={8}
          className="mt-1 h-11 w-full rounded-md border border-black/10 px-3 text-sm font-normal normal-case tracking-normal"
        />
      </label>
      <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
        Confirmar
        <input
          type="password"
          name="confirm"
          required
          minLength={8}
          className="mt-1 h-11 w-full rounded-md border border-black/10 px-3 text-sm font-normal normal-case tracking-normal"
        />
      </label>
      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? "Actualizando…" : "Cambiar contraseña"}
      </button>
      {message ? <p className="text-sm text-sr-green">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
