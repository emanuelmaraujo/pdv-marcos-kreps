import {
  Home,
  ClipboardList,
  CirclePlus,
  Banknote,
  Printer,
  BookOpen,
  Building2,
} from "lucide-react";

export type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
};

export const navItems: NavItem[] = [
  { name: "Início",    href: "/app",                         icon: Home },
  { name: "Pedidos",   href: "/app/pedidos",                 icon: ClipboardList },
  { name: "Novo",      href: "/app/novo-pedido",             icon: CirclePlus },
  { name: "Caixa",     href: "/app/caixa",                   icon: Banknote,  adminOnly: true },
  { name: "Impresso",  href: "/app/impressao",               icon: Printer },
  { name: "Cardápio",  href: "/app/cardapio",                icon: BookOpen,  adminOnly: true },
  { name: "Filiais",   href: "/app/configuracoes/filiais",   icon: Building2, adminOnly: true },
];
