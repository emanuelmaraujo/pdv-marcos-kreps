import {
  Home,
  ClipboardList,
  CirclePlus,
  Banknote,
  Printer,
  BookOpen,
} from "lucide-react";

export const navItems = [
  { name: "Início", href: "/app", icon: Home },
  { name: "Pedidos", href: "/app/pedidos", icon: ClipboardList },
  { name: "Novo", href: "/app/novo-pedido", icon: CirclePlus },
  { name: "Caixa", href: "/app/caixa", icon: Banknote },
  { name: "Impresso", href: "/app/impressao", icon: Printer },
  { name: "Cardápio", href: "/app/cardapio", icon: BookOpen },
] as const;
