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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white pb-safe shadow-[0_-2px_12px_-2px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex h-16 max-w-md items-stretch px-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive
                  ? "text-brand-red"
                  : "text-zinc-400 active:text-zinc-600"
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-b-full bg-brand-red" />
              )}
              <Icon
                className={`h-[22px] w-[22px] ${isActive ? "stroke-[2.5]" : ""}`}
              />
              <span
                className={`text-[10px] leading-none ${isActive ? "font-bold" : "font-medium"}`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
