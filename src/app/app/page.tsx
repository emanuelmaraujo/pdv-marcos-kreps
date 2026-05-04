import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import Link from "next/link";
import { PlusCircle, ListOrdered, Package, Wallet } from "lucide-react";

export default function AppDashboard() {
  const shortcuts = [
    { title: "Novo Pedido", href: "/app/novo-pedido", icon: PlusCircle, color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Pedidos Hoje", href: "/app/pedidos", icon: ListOrdered, color: "text-orange-500", bg: "bg-orange-500/10" },
    { title: "Cardápio", href: "/app/cardapio", icon: Package, color: "text-green-500", bg: "bg-green-500/10" },
    { title: "Caixa", href: "/app/caixa", icon: Wallet, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Início" />
      <div className="p-4 space-y-6 flex-1 overflow-y-auto">
        
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Atalhos</h2>
          <div className="grid grid-cols-2 gap-4">
            {shortcuts.map((s) => {
              const Icon = s.icon;
              return (
                <Link key={s.href} href={s.href}>
                  <Card className="hover:border-primary transition-colors border-border shadow-sm">
                    <CardContent className="p-4 flex flex-col items-center justify-center space-y-3 aspect-square">
                      <div className={`p-4 rounded-full ${s.bg}`}>
                        <Icon className={`w-8 h-8 ${s.color}`} />
                      </div>
                      <span className="font-medium text-sm">{s.title}</span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Resumo Rápido</h2>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm">Aguardando Confirmação</span>
                <span className="font-bold text-primary">0</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm">Na Fila</span>
                <span className="font-bold">0</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm">Prontos</span>
                <span className="font-bold text-green-600">0</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
