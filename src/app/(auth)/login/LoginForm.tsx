"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { claimsFromAccessToken } from "@/lib/commercial/claims";
import { postLoginPath } from "@/lib/commercial/roles";
import { createCommercialBrowserClient } from "@/lib/supabase/commercial/client";

export type LoginVariant = "vendedor" | "portal";

export function LoginForm({
  variant,
  nextPath,
  staffError,
}: {
  variant: LoginVariant;
  nextPath: string | null;
  staffError: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    staffError ? "Se requiere un rol de staff para /gestion." : null,
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createCommercialBrowserClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signError) {
        setError(signError.message);
        setLoading(false);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const role = claimsFromAccessToken(sessionData.session?.access_token).app_role;
      router.replace(postLoginPath(role, nextPath));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de login");
      setLoading(false);
    }
  }

  const inputClass =
    "mt-1 min-h-12 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-base outline-none ring-sr-green/30 focus:ring-2";

  if (variant === "vendedor") {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-sr-sand px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <img
            src="/brand/logo-color.svg"
            alt="Sure Rain"
            className="mx-auto h-10 w-auto sm:h-11"
          />
          <h1 className="mt-8 text-center font-display text-3xl font-bold text-sr-ink">
            Ingresar
          </h1>
          <p className="mt-2 text-center text-sm text-sr-ink/55">
            Acceso al módulo Vendedor
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-sr-ink/70">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-sr-ink/70">
                Contraseña
              </span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>

            {error ? (
              <p
                className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary mt-2 min-h-12 w-full text-base disabled:opacity-60"
            >
              {loading ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl font-bold text-sr-green">Ingresar</h1>
      <p className="mt-2 text-sm text-sr-ink/60">
        Acceso al portal B2B. El catálogo público no requiere login.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-sr-ink/70">Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-sr-green/30 focus:ring-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-sr-ink/70">Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-sr-green/30 focus:ring-2"
          />
        </label>

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:opacity-60"
        >
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
