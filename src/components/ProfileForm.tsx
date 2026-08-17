"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveProfileAction } from "@/lib/commercial/profile-actions";
import { PROFILE_INTERESTS } from "@/lib/commercial/profile-constants";
import type { UserProfile } from "@/lib/commercial/profile";

export function ProfileForm({ profile }: { profile: UserProfile | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = new Set(profile?.interests ?? []);

  return (
    <form
      action={(fd) => {
        setMessage(null);
        setError(null);
        startTransition(async () => {
          const result = await saveProfileAction(fd);
          if (!result.ok) setError(result.error);
          else {
            setMessage("Perfil guardado.");
            router.refresh();
          }
        });
      }}
      className="space-y-4"
    >
      <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
        Nombre
        <input
          name="full_name"
          defaultValue={profile?.full_name ?? ""}
          className="mt-1 h-11 w-full rounded-md border border-black/10 px-3 text-sm font-normal normal-case tracking-normal"
        />
      </label>
      <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
        Teléfono
        <input
          name="phone"
          defaultValue={profile?.phone ?? ""}
          className="mt-1 h-11 w-full rounded-md border border-black/10 px-3 text-sm font-normal normal-case tracking-normal"
        />
      </label>
      <label className="block text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
        Cargo
        <input
          name="position"
          defaultValue={profile?.position ?? ""}
          className="mt-1 h-11 w-full rounded-md border border-black/10 px-3 text-sm font-normal normal-case tracking-normal"
        />
      </label>
      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wider text-sr-ink/45">
          Intereses
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PROFILE_INTERESTS.map((item) => (
            <label
              key={item}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-3 text-sm"
            >
              <input
                type="checkbox"
                name={`interest_${item}`}
                defaultChecked={selected.has(item)}
              />
              {item}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-11 items-center gap-2 text-sm text-sr-ink/70">
        <input
          type="checkbox"
          name="marketing_opt_in"
          defaultChecked={Boolean(profile?.marketing_opt_in)}
        />
        Quiero novedades de Sure Rain
      </label>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar perfil"}
      </button>
      {message ? <p className="text-sm text-sr-green">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
