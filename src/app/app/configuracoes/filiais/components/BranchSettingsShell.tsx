"use client";

import { useState, type ElementType, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Save } from "lucide-react";

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
  children,
}: {
  tabs: BranchSettingsTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
  children: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === activeTab));
  const current = tabs[activeIndex];
  const CurrentIcon = current.icon;
  const accent = current.accent ?? {
    iconBg: "bg-[var(--bg-subtle)]",
    iconColor: "text-[var(--text-secondary)]",
  };
  const isLast = activeIndex === tabs.length - 1;

  function goTo(index: number) {
    if (index < 0 || index >= tabs.length) return;
    setError(null);
    onTabChange(tabs[index].id);
  }

  function handlePrimaryAction() {
    if (!isLast) {
      const validationError = current.validate?.();
      if (validationError) {
        setError(validationError);
        return;
      }
      goTo(activeIndex + 1);
      return;
    }

    for (let index = 0; index < tabs.length; index += 1) {
      const validationError = tabs[index].validate?.();
      if (validationError) {
        onTabChange(tabs[index].id);
        setError(validationError);
        return;
      }
    }

    setError(null);
    onSubmit();
  }

  return (
    <section className="grid items-start gap-5 lg:grid-cols-[17.5rem_minmax(0,1fr)]" aria-label="Configuração da filial">
      <aside className="hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--elevation-1)] lg:sticky lg:top-20 lg:block">
        <div className="border-b border-[var(--border)] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-red">Configuração da filial</p>
              <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{activeIndex + 1} de {tabs.length} áreas</p>
            </div>
            <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-[10px] font-bold text-[var(--text-secondary)]">
              {Math.round(((activeIndex + 1) / tabs.length) * 100)}%
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
            <div className="h-full rounded-full bg-brand-red transition-[width]" style={{ width: `${((activeIndex + 1) / tabs.length) * 100}%` }} />
          </div>
        </div>

        <nav className="space-y-1 p-2" aria-label="Seções da filial">
          {tabs.map((tab, index) => {
            const active = index === activeIndex;
            const done = index < activeIndex;
            const Icon = tab.icon;
            const tabAccent = tab.accent ?? accent;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => goTo(index)}
                aria-current={active ? "step" : undefined}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors ${active ? `${tabAccent.iconBg} ring-1 ring-inset ring-current/10` : "hover:bg-[var(--bg-subtle)]"}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[var(--bg-surface)] shadow-sm" : "bg-[var(--bg-subtle)]"}`}>
                  {done ? <Check className="h-4 w-4 text-[var(--status-success)]" /> : Icon ? <Icon className={`h-4 w-4 ${active ? tabAccent.iconColor : "text-[var(--text-muted)]"}`} /> : null}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-bold ${active ? tabAccent.iconColor : "text-[var(--text-primary)]"}`}>{tab.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-[var(--text-muted)]">{tab.description}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--elevation-1)] lg:hidden">
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
            {CurrentIcon ? (
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent.iconBg}`}>
                <CurrentIcon className={`h-4 w-4 ${accent.iconColor}`} />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Etapa {activeIndex + 1} de {tabs.length}</p>
              <p className="truncate text-sm font-bold text-[var(--text-primary)]">{current.label}</p>
            </div>
            <span className="text-xs font-bold text-brand-red">{Math.round(((activeIndex + 1) / tabs.length) * 100)}%</span>
          </div>
          <nav className="hide-scrollbar flex gap-1.5 overflow-x-auto p-2" aria-label="Seções da filial">
            {tabs.map((tab, index) => {
              const active = index === activeIndex;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-current={active ? "step" : undefined}
                  className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold ${active ? "bg-brand-red text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"}`}
                >
                  {index < activeIndex ? <Check className="h-3.5 w-3.5" /> : Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--elevation-1)]">
          <header className="hidden items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-subtle)]/55 px-6 py-4 lg:flex">
            {CurrentIcon ? (
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent.iconBg}`}>
                <CurrentIcon className={`h-4 w-4 ${accent.iconColor}`} />
              </span>
            ) : null}
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">{current.label}</h2>
              <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">{current.description}</p>
            </div>
          </header>
          <div key={activeTab} className="animate-fade-in p-4 pb-5 sm:p-6">{children}</div>
        </article>

        {error ? (
          <p role="alert" className="rounded-xl border border-[var(--status-danger)]/20 bg-[var(--status-danger-bg)] px-4 py-3 text-sm font-semibold text-[var(--status-danger)]">
            {error}
          </p>
        ) : null}

        <footer className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)]/95 p-3 shadow-[var(--elevation-2)] backdrop-blur md:bottom-3 lg:static lg:bg-[var(--bg-subtle)] lg:shadow-[var(--elevation-1)]">
          <div>
            <p className="hidden text-xs font-bold text-[var(--text-primary)] sm:block">{current.label}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Alterações são aplicadas somente nesta filial.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {activeIndex > 0 ? (
              <button type="button" onClick={() => goTo(activeIndex - 1)} className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]">
                <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Voltar</span>
              </button>
            ) : null}
            <button type="button" onClick={handlePrimaryAction} disabled={submitting} className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-red px-4 text-sm font-bold text-white shadow-sm shadow-brand-red/20 transition-colors hover:bg-brand-red/90 disabled:opacity-60">
              {isLast ? <Save className="h-4 w-4" /> : null}
              {isLast ? submitLabel : "Próximo"}
              {!isLast ? <ChevronRight className="h-4 w-4" /> : null}
            </button>
          </div>
        </footer>
      </div>
    </section>
  );
}
