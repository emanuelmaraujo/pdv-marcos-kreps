"use client";

import { useState, type ElementType, type ReactNode } from "react";
import { CheckCircle2, ChevronDown, Loader2, Save } from "lucide-react";

export interface BranchSettingsTab {
  id: string;
  label: string;
  description: string;
  icon: ElementType;
  accent: { iconBg: string; iconColor: string };
  validate?: () => string | null | undefined;
}

export function BranchSettingsShell({
  tabs,
  activeTab,
  onTabChange,
  onSubmit,
  submitting,
  submitLabel,
  creationMode = false,
  children,
}: {
  tabs: BranchSettingsTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
  creationMode?: boolean;
  children: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const current = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const CurrentIcon = current.icon;
  const showNavigation = tabs.length > 1;

  function goTo(id: string) {
    setError(null);
    onTabChange(id);
  }

  function handleSubmit() {
    for (const tab of tabs) {
      const validationError = tab.validate?.();
      if (validationError) {
        if (tab.id !== activeTab) onTabChange(tab.id);
        setError(validationError);
        return;
      }
    }

    setError(null);
    onSubmit();
  }

  return (
    <section
      className={showNavigation ? "grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-5" : "mx-auto max-w-3xl"}
      aria-label={creationMode ? "Cadastro da filial" : "Configurações da filial"}
    >
      {showNavigation ? (
        <aside className="hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--elevation-1)] lg:sticky lg:top-20 lg:block">
          <div className="border-b border-[var(--border)] px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">Configurar filial</p>
            <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">Escolha uma área</p>
            <p className="mt-1 text-[11px] leading-4 text-[var(--text-secondary)]">Você pode alterar as seções em qualquer ordem.</p>
          </div>

          <nav className="space-y-1 p-2" aria-label="Áreas da filial">
            {tabs.map((tab) => {
              const active = tab.id === activeTab;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => goTo(tab.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40 ${
                    active ? "bg-brand-red/10 text-brand-red" : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? tab.accent.iconBg : "bg-[var(--bg-subtle)]"}`}>
                    <Icon className={`h-4 w-4 ${active ? tab.accent.iconColor : "text-[var(--text-muted)]"}`} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{tab.label}</span>
                    <span className="mt-0.5 block line-clamp-1 text-[10.5px] text-[var(--text-muted)]">{tab.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>
      ) : null}

      <div className="min-w-0 space-y-4">
        {showNavigation ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 shadow-[var(--elevation-1)] lg:hidden">
            <label htmlFor="branch-settings-section" className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              Área da filial
            </label>
            <div className="relative">
              <select
                id="branch-settings-section"
                value={activeTab}
                onChange={(event) => goTo(event.target.value)}
                className="min-h-12 w-full appearance-none rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 pr-10 text-sm font-bold text-[var(--text-primary)] focus:border-brand-red/50 focus:outline-none focus:ring-2 focus-visible:ring-brand-red/15"
              >
                {tabs.map((tab) => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            </div>
          </div>
        ) : null}

        <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--elevation-1)]">
          <header className="flex items-start gap-3 border-b border-[var(--border)] bg-[var(--bg-subtle)]/55 px-4 py-4 sm:px-6">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${current.accent.iconBg}`}>
              <CurrentIcon className={`h-4 w-4 ${current.accent.iconColor}`} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[var(--text-primary)]">{current.label}</h2>
              <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">{current.description}</p>
            </div>
          </header>
          <div key={activeTab} className="animate-fade-in p-4 sm:p-6">{children}</div>
        </article>

        {error ? (
          <p role="alert" className="rounded-xl border border-[var(--status-danger)]/20 bg-[var(--status-danger-bg)] px-4 py-3 text-sm font-semibold text-[var(--status-danger)]">
            {error}
          </p>
        ) : null}

        <footer className="sticky bottom-20 z-10 flex items-center justify-end rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)]/95 p-3 shadow-[var(--elevation-2)] backdrop-blur sm:justify-between sm:gap-3 md:bottom-3 lg:static lg:bg-[var(--bg-subtle)] lg:shadow-[var(--elevation-1)]">
          <div className="hidden min-w-0 items-start gap-2 sm:flex">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-success)]" />
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">{creationMode ? "Primeiro, cadastre a unidade" : "Alterações desta filial"}</p>
              <p className="mt-0.5 text-[10.5px] leading-4 text-[var(--text-muted)]">
                {creationMode ? "As demais configurações serão liberadas após a criação." : "Salvar não altera os padrões gerais nem outras filiais."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-red px-5 text-sm font-bold text-white shadow-sm shadow-brand-red/20 transition-colors hover:bg-brand-red/90 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {submitting ? "Salvando..." : submitLabel}
          </button>
        </footer>
      </div>
    </section>
  );
}
