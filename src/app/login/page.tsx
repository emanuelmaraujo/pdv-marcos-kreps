"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { ChefHat, Fingerprint } from "lucide-react";

const SESSION_KEY = "pdv_login_time";
const SESSION_MAX_MS = 24 * 60 * 60 * 1000;

function storeLoginTime() {
  localStorage.setItem(SESSION_KEY, Date.now().toString());
}

function isSessionExpired(): boolean {
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return false;
  return Date.now() - parseInt(stored) > SESSION_MAX_MS;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSavedCredential, setHasSavedCredential] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Check for saved credential on mount (for biometric quick-login)
  useEffect(() => {
    if (!("credentials" in navigator)) return;
    if (typeof (window as unknown as Record<string, unknown>).PasswordCredential === "undefined") return;
    navigator.credentials
      .get({ password: true, mediation: "silent" } as CredentialRequestOptions)
      .then((cred) => {
        if (cred && "password" in cred) setHasSavedCredential(true);
      })
      .catch(() => {});
  }, []);

  const signInAndRedirect = useCallback(async (emailVal: string, passwordVal: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: emailVal, password: passwordVal });
    if (error) throw error;
    storeLoginTime();

    // Save credential for biometric quick-login
    if ("credentials" in navigator && "PasswordCredential" in window) {
      try {
        const PasswordCredential = (window as unknown as Record<string, unknown>).PasswordCredential as new (init: { id: string; password: string }) => Credential;
        const cred = new PasswordCredential({ id: emailVal, password: passwordVal });
        await navigator.credentials.store(cred);
      } catch {
        // Not critical — ignore if browser doesn't support
      }
    }

    router.push("/app");
  }, [supabase, router]);

  // Enforce 24h client-side session expiry
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session && isSessionExpired()) {
        await supabase.auth.signOut();
        localStorage.removeItem(SESSION_KEY);
      }
    });
  }, [supabase]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInAndRedirect(email, password);
    } catch (err: unknown) {
      setError(translateError((err as Error).message));
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!("credentials" in navigator)) return;
    setBiometricLoading(true);
    setError("");
    try {
      const cred = await navigator.credentials.get({
        password: true,
        mediation: "required",
      } as CredentialRequestOptions) as (Credential & { password?: string }) | null;

      if (!cred || !("password" in cred) || !cred.password) {
        setError("Nenhuma credencial encontrada. Faça login com e-mail e senha primeiro.");
        return;
      }
      await signInAndRedirect(cred.id, cred.password);
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e?.name !== "NotAllowedError") {
        setError(translateError(e.message ?? "Erro desconhecido"));
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-charcoal p-4">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="mb-8 flex flex-col items-center space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-red shadow-lg">
            <ChefHat className="h-9 w-9 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">Marcos Krep&apos;s</h1>
            <p className="mt-1 text-sm text-zinc-400">Ponto de Venda</p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="border-zinc-700/50 bg-zinc-800/50 backdrop-blur-sm shadow-2xl">
          <CardContent className="p-5 pt-5">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="login-email" className="text-sm font-medium text-zinc-300">
                  E-mail
                </label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-zinc-600 bg-zinc-700/50 text-white placeholder:text-zinc-500 focus-visible:ring-brand-red"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="text-sm font-medium text-zinc-300">
                    Senha
                  </label>
                  <a
                    href="/esqueci-senha"
                    className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Esqueceu a senha?
                  </a>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-zinc-600 bg-zinc-700/50 text-white placeholder:text-zinc-500 focus-visible:ring-brand-red"
                />
              </div>
              {error && (
                <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading || biometricLoading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            {/* Biometric quick-login */}
            {"credentials" in navigator && (
              <div className="mt-3">
                <div className="relative flex items-center my-3">
                  <div className="flex-1 border-t border-zinc-700" />
                  <span className="mx-3 text-xs text-zinc-500">ou</span>
                  <div className="flex-1 border-t border-zinc-700" />
                </div>
                <button
                  type="button"
                  onClick={handleBiometricLogin}
                  disabled={loading || biometricLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-zinc-600 bg-zinc-700/30 text-zinc-300 hover:bg-zinc-700/60 active:scale-95 transition-all text-sm font-medium disabled:opacity-50"
                >
                  <Fingerprint className="h-5 w-5 text-brand-red" />
                  {biometricLoading ? "Verificando..." : hasSavedCredential ? "Entrar com digital / Face ID" : "Acesso rápido com digital"}
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-zinc-500">
          PDV Marcos Krep&apos;s · v1.0
        </p>
      </div>
    </div>
  );
}

function translateError(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (msg.includes("Email not confirmed")) return "E-mail não confirmado. Verifique sua caixa de entrada.";
  if (msg.includes("Too many requests")) return "Muitas tentativas. Aguarde alguns minutos.";
  return msg;
}
