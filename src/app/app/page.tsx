import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import Link from "next/link";
import { PlusCircle, ListOrdered, UtensilsCrossed, Wallet } from "lucide-react";

export default function AppDashboard() {
  const shortcuts = [
    {
      title: "Novo Pedido",
      href: "/app/novo-pedido",
      icon: PlusCircle,
      color: "text-brand-red",
      bg: "bg-red-50",
    },
    {
      title: "Pedidos Hoje",
      href: "/app/pedidos",
      icon: ListOrdered,
      color: "text-brand-charcoal",
      bg: "bg-zinc-100",
    },
    {
      title: "Cardápio",
      href: "/app/cardapio",
      icon: UtensilsCrossed,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Caixa",
      href: "/app/caixa",
      icon: Wallet,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Marcos Krep's" subtitle="Painel do atendente" />
      <div className="p-4 space-y-5 flex-1 overflow-y-auto">
        
        <div>
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
            Atalhos
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {shortcuts.map((s) => {
              const Icon = s.icon;
              return (
                <Link key={s.href} href={s.href}>
                  <Card className="hover:border-zinc-200 active:scale-[0.97] transition-all border-zinc-100">
                    <CardContent className="p-4 flex flex-col items-center justify-center space-y-2.5 aspect-square">
                      <div className={`p-3.5 rounded-2xl ${s.bg}`}>
                        <Icon className={`w-7 h-7 ${s.color}`} />
                      </div>
                      <span className="font-semibold text-sm text-brand-charcoal">
                        {s.title}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        <div>
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
  );
}
