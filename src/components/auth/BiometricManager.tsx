"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  enrollPasskey,
  listServerCredentials,
  deleteServerCredential,
  isWebAuthnSupported,
  getStoredUser,
  ServerCredential,
} from "@/lib/webauthn-client";
import { Fingerprint, Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

const MAX_CREDENTIALS = 3;

function relativeDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function BiometricManager() {
  const [credentials, setCredentials] = useState<ServerCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAccessToken(session.access_token);
        setUserId(session.user.id);
        setEmail(session.user.email ?? null);
      }
    });
  }, [supabase]);

  const loadCredentials = async (token: string) => {
    setLoading(true);
    setError("");
    try {
      const creds = await listServerCredentials(token);
      setCredentials(creds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao listar digitais");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    const timer = window.setTimeout(() => loadCredentials(accessToken), 0);
    return () => window.clearTimeout(timer);
  }, [accessToken]);

  const handleEnroll = async () => {
    if (!accessToken || !userId || !email) return;
    if (credentials.length >= MAX_CREDENTIALS) {
      setError("Limite de 3 digitais atingido. Remova uma antes de adicionar.");
      return;
    }
    setEnrolling(true);
    setError("");
    setSuccess("");
    try {
      await enrollPasskey(userId, email, accessToken);
      setSuccess("Digital adicionada com sucesso!");
      await loadCredentials(accessToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao adicionar digital";
      if (!msg.includes("cancelado")) setError(msg);
    } finally {
      setEnrolling(false);
    }
  };

  const handleDelete = async (rowId: string) => {
    if (!accessToken) return;
    if (!window.confirm("Remover esta digital? Você precisará reautenticar com senha neste dispositivo.")) return;
    setDeletingId(rowId);
    setError("");
    try {
      await deleteServerCredential(rowId, accessToken);
      const updated = credentials.filter((c) => c.id !== rowId);
      setCredentials(updated);

      // If deleted the credential for this device and no others remain, clear localStorage
      const stored = getStoredUser();
      if (stored && updated.length === 0) {
        localStorage.removeItem("pdv_webauthn_user");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover digital");
    } finally {
      setDeletingId(null);
    }
  };

  if (!isWebAuthnSupported()) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4 text-center">
        <p className="text-sm font-bold text-[var(--text-secondary)]">
          Biometria não disponível neste dispositivo ou navegador.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-black text-[var(--text-primary)]">
            {credentials.length} de {MAX_CREDENTIALS} digitais cadastradas
          </p>
          <p className="text-xs text-[var(--text-muted)]">Cada digital funciona em qualquer dispositivo onde foi registrada</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 border-2 text-xs font-black gap-1.5 shrink-0"
          onClick={handleEnroll}
          disabled={enrolling || loading || credentials.length >= MAX_CREDENTIALS || !accessToken}
        >
          {enrolling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {enrolling ? "Registrando..." : "Adicionar"}
        </Button>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-[var(--bg-subtle)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            credentials.length >= MAX_CREDENTIALS ? "bg-brand-red" : "bg-[var(--status-success)]"
          }`}
          style={{ width: `${(credentials.length / MAX_CREDENTIALS) * 100}%` }}
        />
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--status-danger)", backgroundColor: "var(--status-danger-bg)" }}>
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "var(--status-danger)" }} />
          <p className="text-sm font-bold" style={{ color: "var(--status-danger)" }}>{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--status-success)", backgroundColor: "var(--status-success-bg)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--status-success)" }}>{success}</p>
        </div>
      )}

      {/* Credentials list */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
        </div>
      ) : credentials.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--border)] p-6 text-center">
          <Fingerprint className="h-8 w-8 text-[var(--text-muted)]" />
          <div>
            <p className="text-sm font-bold text-[var(--text-secondary)]">Nenhuma digital cadastrada</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Toque em &quot;Adicionar&quot; para registrar sua primeira digital</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {credentials.map((cred, i) => (
            <div
              key={cred.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                <Fingerprint className="h-4 w-4 text-violet-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {cred.device_name || `Digital ${i + 1}`}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Adicionada em {relativeDate(cred.created_at)}
                  {cred.last_used_at ? ` · Último uso em ${relativeDate(cred.last_used_at)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(cred.id)}
                disabled={deletingId === cred.id}
                className="shrink-0 rounded-lg p-2 transition-colors hover:bg-[var(--status-danger-bg)] disabled:opacity-50"
                style={{ color: "var(--status-danger)" }}
              >
                {deletingId === cred.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {credentials.length >= MAX_CREDENTIALS && (
        <p className="text-center text-xs font-bold text-brand-red">
          Limite atingido — remova uma digital para adicionar outra
        </p>
      )}
    </div>
  );
}
