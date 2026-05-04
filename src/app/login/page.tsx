"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { ChefHat } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/app");
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
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Marcos Krep&apos;s
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Ponto de Venda
            </p>
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
                <label htmlFor="login-password" className="text-sm font-medium text-zinc-300">
                  Senha
                </label>
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-zinc-500">
          PDV Marcos Krep&apos;s · v1.0
        </p>
      </div>
    </div>
  );
}
