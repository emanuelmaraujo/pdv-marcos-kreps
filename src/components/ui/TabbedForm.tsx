"use client";

import { useState, type ElementType, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

export interface TabbedFormAccent {
  iconBg: string;
  iconColor: string;
}

export interface TabbedFormTab {
  id: string;
  label: string;
  /** Ícone opcional — aparece na aba e no cabeçalho de contexto do conteúdo. */
  icon?: ElementType;
  /** Descrição curta opcional, exibida no cabeçalho de contexto do conteúdo. */
  description?: string;
  accent?: TabbedFormAccent;
  /** Validação antes de avançar/salvar. Retorne uma mensagem de erro para bloquear, ou undefined/null para liberar. */
  validate?: () => string | null | undefined;
}

const DEFAULT_ACCENT: TabbedFormAccent = { iconBg: "bg-zinc-100", iconColor: "text-zinc-600" };

// Sequência de abas com navegação Voltar/Próximo/Salvar e validação por aba
// — usado tanto dentro de um BottomSheet (Usuários) quanto numa página
// própria (Filiais). Não é dono do conteúdo: o caller renderiza o painel da
// aba ativa em `children` (normalmente via `activeTab === tab.id && <X/>`).
//
// `variant="sheet"` (padrão) assume que o pai já é uma caixa de altura
// fixa com scroll próprio (ex: BottomSheet) — usa flex h-full + overflow-y
// interno pra manter a barra de abas e o rodapé colados nas bordas dessa
// caixa.
// `variant="page"` é pra quando o TabbedForm vive solto numa página comum,
// cujo scroll é o da própria viewport (sem container de altura travada) —
// aí barra de abas e rodapé usam `position: sticky` relativo à viewport em
// vez de depender de uma altura calculada a mão (essa conta manual é frágil
// e quebra fácil: barra de baixo suportava atrás do menu inferior mobile ou
// sumia da tela junto com as abas ao rolar). `topOffset`/`bottomOffset`
// ajustam onde cada barra gruda (default: abaixo do TopBar de 3.5rem em
// cima, acima do BottomNav mobile de 5rem embaixo — 0 em telas md+).
export function TabbedForm({
  tabs,
  activeTab,
  onTabChange,
  onSubmit,
  submitLabel = "Salvar",
  submitting = false,
  children,
  variant = "sheet",
  header,
}: {
  tabs: TabbedFormTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onSubmit: () => void;
  submitLabel?: string;
  submitting?: boolean;
  children: ReactNode;
  variant?: "sheet" | "page";
  /** Conteúdo extra fixado acima da barra de abas (ex: título + botão fechar). Só faz sentido com variant="page". */
  header?: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === activeTab));
  const isLast = activeIndex === tabs.length - 1;
  const current = tabs[activeIndex];
  const CurrentIcon = current?.icon;
  const accent = current?.accent ?? DEFAULT_ACCENT;

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

  const isPage = variant === "page";

  const tabBar = (
    <>
      {header}
      <div className="flex gap-1 overflow-x-auto px-3 pt-3 sm:px-5">
        {tabs.map((tab, index) => {
          const active = tab.id === activeTab;
          const done = index < activeIndex;
          const Icon = tab.icon;
          const tabAccent = tab.accent ?? DEFAULT_ACCENT;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => goTo(index)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold transition-all ${
                active
                  ? `${tabAccent.iconBg} ${tabAccent.iconColor} shadow-sm`
                  : done
                    ? "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="mx-3 mt-3 border-b border-[var(--border)] sm:mx-5" />
    </>
  );

  const content = (
    <div
      key={activeTab}
      className={`animate-fade-in ${isPage ? "px-4 py-5 sm:px-6" : "flex-1 overflow-y-auto px-4 py-5 sm:px-6"}`}
    >
      {(CurrentIcon || current?.description) && (
        <div className="mb-5 flex items-center gap-3">
          {CurrentIcon && (
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-black/5 ${accent.iconBg}`}>
              <CurrentIcon className={`h-4.5 w-4.5 ${accent.iconColor}`} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-black text-[var(--text-primary)]">{current?.label}</h2>
            {current?.description && (
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{current.description}</p>
            )}
          </div>
        </div>
      )}
      {children}
      {error && (
        <p className="mt-4 rounded-lg bg-[var(--status-danger-bg)] px-3 py-2 text-xs font-semibold text-[var(--status-danger)]">
          {error}
        </p>
      )}
    </div>
  );

  const nav = (
    <div
      className={`flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 sm:px-6 ${
        isPage ? "sticky bottom-20 z-10 md:bottom-0" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => goTo(activeIndex - 1)}
        disabled={activeIndex === 0}
        className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] disabled:opacity-0"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar
      </button>
      <div className="hidden items-center gap-1 sm:flex">
        {tabs.map((tab, index) => (
          <span
            key={tab.id}
            className={`h-1.5 rounded-full transition-all ${
              index === activeIndex ? "w-5 bg-brand-red" : index < activeIndex ? "w-1.5 bg-brand-red/40" : "w-1.5 bg-[var(--border-strong)]"
            }`}
          />
        ))}
      </div>
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
  );

  if (isPage) {
    return (
      <div>
        <div className="sticky top-14 z-10 bg-[var(--bg-base)]">{tabBar}</div>
        {content}
        {nav}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {tabBar}
      {content}
      {nav}
    </div>
  );
}
