"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CreditCard,
  FileClock,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useBranch } from "@/contexts/BranchContext";

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
    <main className="min-h-full bg-[var(--bg-subtle)]/50 px-4 py-5 pb-28 sm:px-6 md:py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
          <div className="bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 p-6 text-white sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">Central de administração</p>
                <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Configurações organizadas por escopo</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
                  {isGlobalAdmin
                    ? "Você administra a rede inteira. Confirme a filial ativa antes de alterar regras operacionais."
                    : `Você administra somente ${currentBranch?.name ?? "sua filial"}. As regras globais ficam protegidas.`}
                </p>
              </div>
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 sm:flex">
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-white/10 px-3 py-1.5">{isGlobalAdmin ? "Administrador global" : "Administrador de filial"}</span>
              {currentBranch && <span className="rounded-full bg-brand-red/90 px-3 py-1.5">Filial ativa: {currentBranch.name}</span>}
            </div>
          </div>
        </section>

        <section aria-labelledby="settings-sections-title">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <h2 id="settings-sections-title" className="text-lg font-black text-[var(--text-primary)]">Áreas de configuração</h2>
              <p className="text-sm text-[var(--text-muted)]">Cada alteração fica vinculada ao escopo correto.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  className="group flex min-h-36 items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-brand-red">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-black text-[var(--text-primary)]">{section.title}</span>
                      <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">{section.scope}</span>
                    </span>
                    <span className="mt-2 block text-sm leading-5 text-[var(--text-muted)]">{section.description}</span>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-brand-red">
                      Abrir <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Link href="/app/configuracoes/auditoria" className="group rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-sm transition hover:border-[var(--border-strong)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red">
            <FileClock className="h-5 w-5 text-[var(--text-muted)]" />
            <h2 className="mt-3 font-black text-[var(--text-primary)]">Histórico de alterações</h2>
            <p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">Consulte autor, data, área e filial sem expor valores sensíveis.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-brand-red">Consultar <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
          </Link>
          <Link href="/app/configuracoes/pagamentos" className="group rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-sm transition hover:border-[var(--border-strong)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red">
            <ShieldCheck className="h-5 w-5 text-[var(--text-muted)]" />
            <h2 className="mt-3 font-black text-[var(--text-primary)]">Saúde da configuração</h2>
            <p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">Revise agora taxas ausentes e regras financeiras ativas por filial.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-brand-red">Verificar <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
          </Link>
        </section>
      </div>
    </main>
  );
}
