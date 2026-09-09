"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CreditCard,
  FileClock,
  LayoutGrid,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useBranch } from "@/contexts/BranchContext";
import { SettingsBadge, SettingsPageHeader } from "./components/SettingsPageHeader";

const sections = [
  {
    title: "Usuários e acessos",
    description: "Equipe, papéis, filiais autorizadas e credenciais.",
    href: "/app/configuracoes/usuarios",
    icon: Users,
    scope: "Filial",
    globalOnly: false,
  },
  {
    title: "Filiais",
    description: "Operação, horários, entrega, WhatsApp e impressão por unidade.",
    href: "/app/configuracoes/filiais",
    icon: Building2,
    scope: "Filial",
    globalOnly: false,
  },
  {
    title: "Pagamentos e taxas",
    description: "Débito, crédito, parcelamento, vigência e custo estimado.",
    href: "/app/configuracoes/pagamentos",
    icon: CreditCard,
    scope: "Filial",
    globalOnly: false,
  },
  {
    title: "Configurações gerais",
    description: "Padrões da rede, integrações e comportamento global do PDV.",
    href: "/app/configuracoes/geral",
    icon: Settings2,
    scope: "Global",
    globalOnly: true,
  },
] as const;

export default function SettingsHomePage() {
  const { isGlobalAdmin } = useUser();
  const { currentBranch } = useBranch();
  const visibleSections = sections.filter((section) => !section.globalOnly || isGlobalAdmin);

  return (
    <main className="mx-auto max-w-6xl space-y-7">
      <SettingsPageHeader
        eyebrow="Visão geral"
        title="Administre a operação com clareza"
        description={isGlobalAdmin
          ? "Acompanhe configurações da rede e confirme a filial ativa antes de alterar regras operacionais."
          : `Seu acesso está limitado a ${currentBranch?.name ?? "sua filial"}. Configurações globais permanecem protegidas.`}
        icon={LayoutGrid}
        meta={
          <>
            <SettingsBadge tone="info">{isGlobalAdmin ? "Escopo global" : "Escopo da filial"}</SettingsBadge>
            {currentBranch ? <SettingsBadge>{currentBranch.code} · {currentBranch.name}</SettingsBadge> : null}
          </>
        }
      />

      <section aria-labelledby="settings-sections-title">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 id="settings-sections-title" className="text-lg font-bold text-[var(--text-primary)]">Áreas de configuração</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Escolha uma área para revisar ou alterar.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  className="group flex min-h-48 flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-[var(--elevation-1)] transition hover:-translate-y-0.5 hover:border-brand-red/30 hover:shadow-[var(--elevation-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red ring-1 ring-brand-red/10">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="mt-4 flex items-start justify-between gap-2">
                    <span className="font-bold text-[var(--text-primary)]">{section.title}</span>
                    <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{section.scope}</span>
                  </span>
                  <span className="mt-2 block text-sm leading-5 text-[var(--text-secondary)]">{section.description}</span>
                  <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-bold text-brand-red">
                      Abrir <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
          <Link href="/app/configuracoes/auditoria" className="group flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-[var(--elevation-1)] transition hover:border-[var(--border-strong)] hover:shadow-[var(--elevation-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text-secondary)]"><FileClock className="h-5 w-5" /></span>
            <span><span className="font-bold text-[var(--text-primary)]">Histórico de alterações</span><span className="mt-1 block text-sm leading-5 text-[var(--text-secondary)]">Consulte autor, data, área e filial sem expor valores sensíveis.</span><span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-red">Consultar <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span></span>
          </Link>
          <Link href="/app/configuracoes/pagamentos" className="group flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-[var(--elevation-1)] transition hover:border-[var(--border-strong)] hover:shadow-[var(--elevation-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success)]"><ShieldCheck className="h-5 w-5" /></span>
            <span><span className="font-bold text-[var(--text-primary)]">Saúde da configuração</span><span className="mt-1 block text-sm leading-5 text-[var(--text-secondary)]">Revise taxas ausentes e regras financeiras ativas por filial.</span><span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-red">Verificar <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span></span>
          </Link>
      </section>
    </main>
  );
}
