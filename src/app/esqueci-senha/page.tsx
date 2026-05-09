"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { ChefHat, ArrowLeft, Mail, CheckCircle } from "lucide-react";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-charcoal p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-red shadow-lg">
            <ChefHat className="h-9 w-9 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">Marcos Krep&apos;s</h1>
            <p className="mt-1 text-sm text-zinc-400">Recuperação de senha</p>
          </div>
        </div>

        <Card className="border-zinc-700/50 bg-zinc-800/50 backdrop-blur-sm shadow-2xl">
          <CardContent className="p-5 pt-5">
            {sent ? (
              <div className="flex flex-col items-center space-y-4 py-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                  <CheckCircle className="h-9 w-9 text-emerald-400" />
                </div>
                <div>
                  <p className="font-bold text-white">E-mail enviado!</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Verifique sua caixa de entrada em <span className="text-white">{email}</span> e clique no link para redefinir sua senha.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                  onClick={() => router.push("/login")}
                >
                  Voltar para o login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-zinc-400">
                  Digite seu e-mail e enviaremos um link para redefinir sua senha.
                </p>
                <div className="space-y-2">
                  <label htmlFor="recovery-email" className="text-sm font-medium text-zinc-300">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      id="recovery-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                  {loading ? "Enviando..." : "Enviar link de recuperação"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {!sent && (
          <button
            onClick={() => router.push("/login")}
            className="mt-4 flex w-full items-center justify-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o login
          </button>
        )}
      </div>
    </div>
  );
}
