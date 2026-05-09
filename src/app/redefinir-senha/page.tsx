"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Lock, CheckCircle, AlertCircle } from "lucide-react";
import Image from "next/image";

export default function RedefinirSenhaPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // Also check for existing session with recovery type
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => {
        supabase.auth.signOut();
        router.push("/login");
      }, 3000);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-charcoal p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center space-y-3">
          <div className="rounded-2xl ring-2 ring-zinc-600 shadow-2xl overflow-hidden">
            <Image src="/logo.png" alt="Marcos Krep's" width={64} height={64} className="block" priority />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">Marcos Krep&apos;s</h1>
            <p className="mt-1 text-sm text-zinc-400">Redefinir senha</p>
          </div>
        </div>

        <Card className="border-zinc-700/50 bg-zinc-800/50 backdrop-blur-sm shadow-2xl">
          <CardContent className="p-5 pt-5">
            {done ? (
              <div className="flex flex-col items-center space-y-4 py-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                  <CheckCircle className="h-9 w-9 text-emerald-400" />
                </div>
                <div>
                  <p className="font-bold text-white">Senha redefinida!</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Você será redirecionado para o login em instantes...
                  </p>
                </div>
              </div>
            ) : !ready ? (
              <div className="flex flex-col items-center space-y-4 py-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
                  <AlertCircle className="h-9 w-9 text-amber-400" />
                </div>
                <div>
                  <p className="font-bold text-white">Link inválido ou expirado</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Solicite um novo link de recuperação de senha.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                  onClick={() => router.push("/esqueci-senha")}
                >
                  Solicitar novo link
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-zinc-400">Escolha uma nova senha segura.</p>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Nova senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-10 border-zinc-600 bg-zinc-700/50 text-white placeholder:text-zinc-500 focus-visible:ring-brand-red"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Confirmar senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      type="password"
                      placeholder="Repita a nova senha"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      className="pl-10 border-zinc-600 bg-zinc-700/50 text-white placeholder:text-zinc-500 focus-visible:ring-brand-red"
                    />
                  </div>
                </div>
                {error && (
                  <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400">
                    {error}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar nova senha"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
