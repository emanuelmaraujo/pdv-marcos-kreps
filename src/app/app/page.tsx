"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import Link from "next/link";
import { CirclePlus, ClipboardList, BookOpen, Banknote, SlidersHorizontal, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AppDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (profile?.role === 'ADMIN') {
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
    <div className="flex flex-col h-full">
      <PageHeader title="Marcos Krep's" subtitle="Painel do atendente" />
      <div className="p-4 md:p-6 lg:p-8 space-y-5 flex-1 overflow-y-auto">

        <div className="lg:grid lg:grid-cols-3 lg:gap-8 lg:items-start">
          {/* Left column — shortcuts */}
          <div className="lg:col-span-2 space-y-5">
            <div>
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                Atalhos
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
                {shortcuts.map((s) => {
                  const Icon = s.icon;
                  return (
                    <Link key={s.href} href={s.href}>
                      <Card className="hover:border-zinc-200 active:scale-[0.97] transition-all border-zinc-100 h-full">
                        <CardContent className="p-4 flex flex-col items-center justify-center space-y-2.5 aspect-square">
                          <div className={`p-3.5 rounded-2xl ${s.bg}`}>
                            <Icon className={`w-7 h-7 ${s.color}`} />
                          </div>
                          <span className="font-semibold text-sm text-brand-charcoal text-center">
                            {s.title}
                          </span>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>

            {isAdmin && (
              <div>
                <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                  Administração
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
                  {adminShortcuts.map((s) => {
                    const Icon = s.icon;
                    return (
                      <Link key={s.href} href={s.href}>
                        <Card className="hover:border-zinc-200 active:scale-[0.97] transition-all border-zinc-100 h-full">
                          <CardContent className="p-4 flex flex-col items-center justify-center space-y-2.5 aspect-square">
                            <div className={`p-3.5 rounded-2xl ${s.bg}`}>
                              <Icon className={`w-7 h-7 ${s.color}`} />
                            </div>
                            <span className="font-semibold text-sm text-brand-charcoal text-center">
                              {s.title}
                            </span>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right column — quick summary (full-width on mobile, sidebar on desktop) */}
          <div className="mt-5 lg:mt-0">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
              Resumo Rápido
            </h2>
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="flex justify-between items-center py-2.5 border-b border-zinc-100">
                  <span className="text-sm text-zinc-600">Aguardando Confirmação</span>
                  <span className="font-bold text-brand-amber">0</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-zinc-100">
                  <span className="text-sm text-zinc-600">Na Fila</span>
                  <span className="font-bold text-brand-charcoal">0</span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-sm text-zinc-600">Prontos</span>
                  <span className="font-bold text-emerald-600">0</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

