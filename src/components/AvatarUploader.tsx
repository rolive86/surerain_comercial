"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createCommercialBrowserClient } from "@/lib/supabase/commercial/client";
import { saveAvatarPathAction } from "@/lib/commercial/profile-actions";

const MAX_BYTES = 2 * 1024 * 1024;

export function AvatarUploader({
  userId,
  currentUrl,
  initial,
}: {
  userId: string;
  currentUrl: string | null;
  initial: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [error, setError] = useState<string | null>(null);

  function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Usá un archivo de imagen.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Máximo 2 MB.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/avatar.${ext}`;
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    startTransition(async () => {
      const supabase = createCommercialBrowserClient();
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      const saved = await saveAvatarPathAction(path);
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative h-20 w-20 overflow-hidden rounded-full bg-sr-green text-2xl font-bold text-white"
        aria-label="Cambiar foto de perfil"
        disabled={pending}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </button>
      <div>
        <button
          type="button"
          className="btn-secondary !min-h-11 text-sm"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
        >
          {pending ? "Subiendo…" : "Subir foto"}
        </button>
        <p className="mt-1 text-xs text-sr-ink/45">JPG, PNG o WebP · máx. 2 MB</p>
        {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}
