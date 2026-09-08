import {
  Home,
  ClipboardList,
  CirclePlus,
  Banknote,
  Printer,
  BookOpen,
  Settings,
  Bike,
  Wallet,
} from "lucide-react";
import type { UserRole } from "@/types/pdv";

export type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  /** Restringe o item a papéis específicos. Omitido = ADMIN + ATTENDANT. */
  roles?: UserRole[];
  /**
   * Marca o item como ativo só na rota exata. Necessário quando existe um item
   * irmão numa sub-rota (ex: /app/motoboy e /app/motoboy/historico) — sem isso
   * os dois acendem ao mesmo tempo.
   */
  exact?: boolean;
  /** Mantém a barra inferior enxuta (máximo de cinco destinos). */
  showInBottomNav?: boolean;
};

const STAFF_ROLES: UserRole[] = ["ADMIN", "ATTENDANT"];

export const navItems: NavItem[] = [
  { name: "Início",    href: "/app",                         icon: Home, showInBottomNav: true },
  { name: "Pedidos",   href: "/app/pedidos",                 icon: ClipboardList, showInBottomNav: true },
  { name: "Novo",      href: "/app/novo-pedido",             icon: CirclePlus, showInBottomNav: true },
  { name: "Caixa",     href: "/app/caixa",                   icon: Banknote,  adminOnly: true, showInBottomNav: true },
  { name: "Impresso",  href: "/app/impressao",               icon: Printer },
  { name: "Cardápio",  href: "/app/cardapio",                icon: BookOpen,  adminOnly: true },
  { name: "Configurações", href: "/app/configuracoes",       icon: Settings, adminOnly: true, showInBottomNav: true },
  { name: "Minhas Entregas", href: "/app/motoboy",           icon: Bike,      roles: ["COURIER"], exact: true, showInBottomNav: true },
  { name: "Histórico", href: "/app/motoboy/historico",       icon: Wallet,    roles: ["COURIER"], showInBottomNav: true },
];

/** Regra única de "item ativo" compartilhada pela sidebar e pela tab bar. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/app" || item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function isNavItemVisible(item: NavItem, role: UserRole | undefined): boolean {
  if (!role) return false;
  const allowedRoles = item.roles ?? STAFF_ROLES;
  if (!allowedRoles.includes(role)) return false;
  if (item.adminOnly && role !== "ADMIN") return false;
  return true;
}
