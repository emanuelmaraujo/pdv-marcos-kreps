"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  isWebAuthnSupported,
  hasEnrolledPasskey,
  authenticateWithPasskey,
} from "@/lib/webauthn-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Fingerprint } from "lucide-react";
import Image from "next/image";

const SESSION_KEY = "pdv_login_time";
const SESSION_MAX_MS = 24 * 60 * 60 * 1000;

const ALLOWED_EMAIL_DOMAIN = "marcoskreps.com.br";

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h.endsWith(".local");
}

function isAllowedEmail(email: string): boolean {
  if (isLocalhost()) return true;
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

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
  const [showBiometric] = useState(
    () => isWebAuthnSupported() && hasEnrolledPasskey(),
  );
  const router = useRouter();
  const supabase = createClient();

  const redirectAfterLogin = useCallback(() => {
    storeLoginTime();
    router.push("/app");
  }, [router]);

  const signInAndRedirect = useCallback(
    async (emailVal: string, passwordVal: string) => {
      if (!isAllowedEmail(emailVal)) {
        throw new Error(`Apenas e-mails @${ALLOWED_EMAIL_DOMAIN} podem acessar o sistema.`);
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: emailVal,
        password: passwordVal,
      });
      if (error) throw error;
      redirectAfterLogin();
    },
    [supabase, redirectAfterLogin],
  );

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
    setBiometricLoading(true);
    setError("");
    try {
      // authenticateWithPasskey triggers OS biometric prompt and returns a session token
      const { token_hash } = await authenticateWithPasskey();

      // Exchange the token for a Supabase session (no email is sent)
      const { error: otpErr } = await supabase.auth.verifyOtp({
        token_hash,
        type: "magiclink",
      });
      if (otpErr) throw otpErr;

      redirectAfterLogin();
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      // NotAllowedError = user cancelled the biometric prompt — no error message needed
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
          <div className="rounded-2xl ring-2 ring-zinc-600 shadow-2xl overflow-hidden">
            <Image
              src="/logo.png"
              alt="Marcos Krep's"
              width={96}
              height={96}
              className="block"
              priority
            />
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

            {/* Biometric quick-login — shown only after user enrolls on this device */}
            {showBiometric && (
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
                  {biometricLoading ? "Verificando biometria..." : "Entrar com digital / Face ID"}
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
