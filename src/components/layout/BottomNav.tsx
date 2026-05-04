"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ListOrdered,
  PlusCircle,
  Printer,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Início", href: "/app", icon: Home },
    { name: "Pedidos", href: "/app/pedidos", icon: ListOrdered },
    { name: "Novo", href: "/app/novo-pedido", icon: PlusCircle },
    { name: "Caixa", href: "/app/caixa", icon: Wallet },
    { name: "Impresso", href: "/app/impressao", icon: Printer },
    { name: "Cardápio", href: "/app/cardapio", icon: UtensilsCrossed },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex h-16 bg-card border-t border-border px-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center justify-center space-y-1 ${
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[9px] font-medium leading-none">{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
