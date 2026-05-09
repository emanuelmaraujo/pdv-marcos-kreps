"use client";

import { useState } from "react";
import { Fingerprint, Loader2, X } from "lucide-react";
import { enrollPasskey, isWebAuthnSupported } from "@/lib/webauthn-client";

interface Props {
  userId: string;
  email: string;
  accessToken: string;
  onDismiss: () => void;
}

export function BiometricEnrollPrompt({ userId, email, accessToken, onDismiss }: Props) {
  const [enrolling, setEnrolling] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!isWebAuthnSupported()) return null;

  const handleEnroll = async () => {
    setEnrolling(true);
    setError("");
    try {
      await enrollPasskey(userId, email, accessToken);
      setDone(true);
      setTimeout(onDismiss, 1800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao cadastrar digital";
      if ((err as { name?: string }).name !== "NotAllowedError") {
        setError(msg);
      }
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 pb-safe md:bottom-6 md:right-6 md:left-auto md:max-w-sm">
      <div className="relative rounded-2xl border border-zinc-700/60 bg-zinc-800 shadow-2xl p-5">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded-lg p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-red/10">
            <Fingerprint className="h-6 w-6 text-brand-red" />
          </div>

          <div className="flex-1 min-w-0">
            {done ? (
              <p className="text-sm font-semibold text-emerald-400">
                Digital cadastrada! Na próxima vez, entre com um toque.
              </p>
            ) : (
              <>
                <p className="text-sm font-semibold text-white leading-snug">
                  Cadastrar digital para acesso rápido
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Entre sem digitar senha na próxima vez.
                </p>

                {error && (
                  <p className="mt-2 text-xs font-medium text-red-400">{error}</p>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleEnroll}
                    disabled={enrolling}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-red px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-red/90 disabled:opacity-60 transition-colors"
                  >
                    {enrolling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Fingerprint className="h-3.5 w-3.5" />
                    )}
                    {enrolling ? "Cadastrando..." : "Cadastrar agora"}
                  </button>
                  <button
                    type="button"
                    onClick={onDismiss}
                    disabled={enrolling}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-60"
                  >
                    Agora não
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
