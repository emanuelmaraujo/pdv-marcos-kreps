"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  BookOpen,
  CirclePlus,
  ClipboardList,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";

export default function AppDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function checkRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profile?.role === "ADMIN") {
          setIsAdmin(true);
        }
      }
    }
    checkRole();
  }, [supabase]);

  const shortcuts = [
    {
      title: "Novo Pedido",
      href: "/app/novo-pedido",
      icon: CirclePlus,
      color: "text-brand-red",
      bg: "bg-red-50",
    },
    {
      title: "Pedidos Hoje",
      href: "/app/pedidos",
      icon: ClipboardList,
      color: "text-brand-charcoal",
      bg: "bg-zinc-100",
    },
    {
      title: "Cardápio",
      href: "/app/cardapio",
      icon: BookOpen,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Caixa",
      href: "/app/caixa",
      icon: Banknote,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ];

  const adminShortcuts = [
    {
      title: "Usuários",
      href: "/app/usuarios",
      icon: Users,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      title: "Configurações",
      href: "/app/configuracoes",
      icon: SlidersHorizontal,
      color: "text-zinc-600",
      bg: "bg-zinc-100",
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 p-4 md:p-6 lg:p-8">
        <div className="lg:grid lg:grid-cols-3 lg:items-start lg:gap-8">
          <div className="space-y-5 lg:col-span-2">
            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">
                Atalhos
              </h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {shortcuts.map((shortcut) => {
                  const Icon = shortcut.icon;
                  return (
                    <Link key={shortcut.href} href={shortcut.href}>
                      <Card className="h-full border-zinc-100 transition-all hover:border-zinc-200 active:scale-[0.97]">
                        <CardContent className="flex aspect-square flex-col items-center justify-center space-y-2.5 p-4">
                          <div className={`rounded-2xl p-3.5 ${shortcut.bg}`}>
                            <Icon className={`h-7 w-7 ${shortcut.color}`} />
                          </div>
                          <span className="text-center text-sm font-semibold text-brand-charcoal">
                            {shortcut.title}
                          </span>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>

            {isAdmin && (
              <section>
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Administração
                </h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {adminShortcuts.map((shortcut) => {
                    const Icon = shortcut.icon;
                    return (
                      <Link key={shortcut.href} href={shortcut.href}>
                        <Card className="h-full border-zinc-100 transition-all hover:border-zinc-200 active:scale-[0.97]">
                          <CardContent className="flex aspect-square flex-col items-center justify-center space-y-2.5 p-4">
                            <div className={`rounded-2xl p-3.5 ${shortcut.bg}`}>
                              <Icon className={`h-7 w-7 ${shortcut.color}`} />
                            </div>
                            <span className="text-center text-sm font-semibold text-brand-charcoal">
                              {shortcut.title}
                            </span>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          <section className="mt-5 lg:mt-0">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">
              Resumo Rápido
            </h2>
            <Card>
              <CardContent className="space-y-1 p-4">
                <div className="flex items-center justify-between border-b border-zinc-100 py-2.5">
                  <span className="text-sm text-zinc-600">Aguardando Confirmação</span>
                  <span className="font-bold text-brand-amber">0</span>
                </div>
                <div className="flex items-center justify-between border-b border-zinc-100 py-2.5">
                  <span className="text-sm text-zinc-600">Na Fila</span>
                  <span className="font-bold text-brand-charcoal">0</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-zinc-600">Prontos</span>
                  <span className="font-bold text-emerald-600">0</span>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
