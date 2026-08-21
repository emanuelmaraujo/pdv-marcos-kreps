"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

export interface TabbedFormTab {
  id: string;
  label: string;
  /** Validação antes de avançar/salvar. Retorne uma mensagem de erro para bloquear, ou undefined/null para liberar. */
  validate?: () => string | null | undefined;
}

// Sequência de abas com navegação Voltar/Próximo/Salvar e validação por aba
// — usado tanto dentro de um BottomSheet (Usuários) quanto numa página
// própria (Filiais). Não é dono do conteúdo: o caller renderiza o painel da
// aba ativa em `children` (normalmente via `activeTab === tab.id && <X/>`).
export function TabbedForm({
  tabs,
  activeTab,
  onTabChange,
  onSubmit,
  submitLabel = "Salvar",
  submitting = false,
  children,
}: {
  tabs: TabbedFormTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onSubmit: () => void;
  submitLabel?: string;
  submitting?: boolean;
  children: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === activeTab));
  const isLast = activeIndex === tabs.length - 1;
  const current = tabs[activeIndex];

  function goTo(index: number) {
    if (index < 0 || index >= tabs.length) return;
    setError(null);
    onTabChange(tabs[index].id);
  }

  function handleNext() {
    if (isLast) {
      // A barra de abas permite pular direto pra última aba sem passar pelo
      // "Próximo" das anteriores — então, ao enviar, valida TODAS as abas em
      // ordem (não só a atual) e leva o usuário de volta pra primeira que
      // falhar, em vez de deixar passar um campo obrigatório não preenchido.
      for (let index = 0; index < tabs.length; index++) {
        const validationError = tabs[index]?.validate?.();
        if (validationError) {
          // goTo() limpa o erro ao trocar de aba — chamar depois dele pra a
          // mensagem não ser apagada pelo próprio setError(null) interno.
          goTo(index);
          setError(validationError);
          return;
        }
      }
      setError(null);
      onSubmit();
      return;
    }

    const validationError = current?.validate?.();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    goTo(activeIndex + 1);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Barra de abas */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-[var(--border)] px-4 pt-1 sm:px-6">
        {tabs.map((tab, index) => {
          const active = tab.id === activeTab;
          const done = index < activeIndex;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => goTo(index)}
              className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-xs font-bold transition-colors ${
                active
                  ? "text-brand-red"
                  : done
                    ? "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {done && <Check className="h-3.5 w-3.5" />}
              {tab.label}
              {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-red" />}
            </button>
          );
        })}
      </div>

      {/* Conteúdo da aba ativa */}
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {children}
        {error && (
          <p className="mt-4 rounded-lg bg-[var(--status-danger-bg)] px-3 py-2 text-xs font-semibold text-[var(--status-danger)]">
            {error}
          </p>
        )}
      </div>

      {/* Navegação */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => goTo(activeIndex - 1)}
          disabled={activeIndex === 0}
          className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] disabled:opacity-0"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          className="flex items-center gap-1.5 rounded-xl bg-brand-red px-5 py-2.5 text-sm font-black text-white shadow-md shadow-brand-red/25 transition-all hover:bg-brand-red/90 active:scale-[0.98] disabled:opacity-60"
        >
          {isLast ? submitLabel : "Próximo"}
          {!isLast && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
