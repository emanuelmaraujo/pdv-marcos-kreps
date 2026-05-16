import {
  Home,
  ClipboardList,
  CirclePlus,
  Banknote,
  Printer,
  BookOpen,
  Building2,
} from "lucide-react";

export const navItems = [
  { name: "Início", href: "/app", icon: Home },
  { name: "Pedidos", href: "/app/pedidos", icon: ClipboardList },
  { name: "Novo", href: "/app/novo-pedido", icon: CirclePlus },
  { name: "Caixa", href: "/app/caixa", icon: Banknote },
  { name: "Impresso", href: "/app/impressao", icon: Printer },
  { name: "Cardápio", href: "/app/cardapio", icon: BookOpen },
  { name: "Filiais", href: "/app/configuracoes/filiais", icon: Building2 },
] as const;
