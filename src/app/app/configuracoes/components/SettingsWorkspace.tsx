"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronRight,
  CreditCard,
  FileClock,
  LayoutGrid,
  Settings2,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";
import { useUser } from "@/contexts/UserContext";

const NAV_ITEMS = [
  { href: "/app/configuracoes", label: "Visão geral", shortLabel: "Início", icon: LayoutGrid, exact: true },
  { href: "/app/configuracoes/usuarios", label: "Usuários", shortLabel: "Usuários", icon: Users },
  { href: "/app/configuracoes/filiais", label: "Filiais", shortLabel: "Filiais", icon: Building2 },
  { href: "/app/configuracoes/pagamentos", label: "Pagamentos", shortLabel: "Taxas", icon: CreditCard },
  { href: "/app/configuracoes/geral", label: "Geral", shortLabel: "Geral", icon: Settings2, globalOnly: true },
  { href: "/app/configuracoes/auditoria", label: "Auditoria", shortLabel: "Histórico", icon: FileClock },
] as const;

export function SettingsWorkspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentBranch } = useBranch();
  const { isGlobalAdmin } = useUser();
  const items = NAV_ITEMS.filter((item) => !("globalOnly" in item && item.globalOnly) || isGlobalAdmin);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[var(--bg-base)] pb-24 md:pb-4">
      <div className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red ring-1 ring-brand-red/15">
                <SlidersHorizontal className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)]">
                  Administração <ChevronRight className="h-3 w-3" /> Configurações
                </div>
                <h1 className="truncate text-base font-bold tracking-tight text-[var(--text-primary)] sm:text-lg">
                  Central de configurações
                </h1>
              </div>
            </div>
            <div className="hidden min-w-0 items-center gap-2 sm:flex">
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                {isGlobalAdmin ? "Administrador global" : "Administrador de filial"}
              </span>
              {currentBranch ? (
                <span className="max-w-52 truncate rounded-full bg-brand-red/10 px-3 py-1.5 text-xs font-semibold text-brand-red">
                  {currentBranch.code} · {currentBranch.name}
                </span>
              ) : null}
            </div>
          </div>

          <nav aria-label="Seções das configurações" className="hide-scrollbar -mx-4 mt-4 flex gap-1 overflow-x-auto px-4 sm:-mx-2 sm:px-2">
            {items.map((item) => {
              const active = "exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40 ${
                    active
                      ? "bg-brand-red text-white shadow-sm shadow-brand-red/20"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="sm:hidden">{item.shortLabel}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">{children}</div>
    </div>
  );
}
