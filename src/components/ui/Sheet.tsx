"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Sheet — overlay responsivo único do kit.
 *
 * Mobile (<768px): sobe do rodapé (padrão nativo esperado em toque).
 * Desktop (md:+): a mesma marcação vira modal centralizado.
 *
 * Substitui a duplicação de overlays `fixed inset-0` feitos à mão
 * (ex: OrderDetailsModal/PayItemsModal antes desta primitiva existir) —
 * é uma única implementação, não duas mantidas em paralelo.
 * Ver docs/plano-acao-ux-ui.md, Fase 0.
 */
interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Título simples — vira a barra de cabeçalho padrão (título + botão fechar). */
  title?: string;
  /** Cabeçalho customizado, substitui a barra padrão inteira (inclui seu próprio
   * botão de fechar). Usado quando o conteúdo precisa de mais que um título —
   * ex: badges de status, timeline, resumo — que não cabe numa string. */
  header?: React.ReactNode;
  children: React.ReactNode;
  /** Largura máxima do modal em desktop. Sheet mobile sempre ocupa a largura toda. */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "3xl";
  footer?: React.ReactNode;
  /** Substitui as classes padrão do corpo (`max-h-[75vh] overflow-y-auto`) —
   * necessário quando o conteúdo gerencia seu próprio scroll interno (ex:
   * painéis lado a lado cada um com overflow-y-auto próprio). */
  bodyClassName?: string;
}

const MAX_WIDTH: Record<NonNullable<SheetProps["maxWidth"]>, string> = {
  sm: "md:max-w-sm",
  md: "md:max-w-md",
  lg: "md:max-w-lg",
  xl: "md:max-w-2xl",
  "3xl": "md:max-w-3xl",
};

export function Sheet({ isOpen, onClose, title, header, children, maxWidth = "md", footer, bodyClassName }: SheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !sheetRef.current) return;

    const viewport = window.visualViewport;
    const updateKeyboardInset = () => {
      if (!sheetRef.current) return;
      const inset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      sheetRef.current.style.setProperty("--keyboard-inset", `${inset}px`);
    };
    updateKeyboardInset();
    viewport?.addEventListener("resize", updateKeyboardInset);
    viewport?.addEventListener("scroll", updateKeyboardInset);
    return () => {
      viewport?.removeEventListener("resize", updateKeyboardInset);
      viewport?.removeEventListener("scroll", updateKeyboardInset);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0 md:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={header ? undefined : "sheet-title"}
    >
      <div
        className="animate-sheet-fade-in fixed inset-0 bg-zinc-900/45"
        onClick={onClose}
      />

      <div
        ref={sheetRef}
        className={`animate-sheet-slide-up md:animate-modal-scale-in relative z-[75] flex w-full ${MAX_WIDTH[maxWidth]} flex-col overflow-hidden rounded-t-3xl bg-[var(--bg-surface)] text-[var(--text-primary)] transform-gpu will-change-transform md:rounded-2xl`}
        style={{
          boxShadow: "var(--elevation-4)",
          maxHeight: "calc(90dvh - var(--keyboard-inset, 0px))",
          marginBottom: "var(--keyboard-inset, 0px)",
        }}
      >
        {header ?? (
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
            <h2 id="sheet-title" className="text-subtitle font-semibold text-[var(--text-primary)]">
              {title}
            </h2>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Fechar"
              className="focus-ring relative -mr-2 rounded-full p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] after:absolute after:inset-[-8px] after:content-['']"
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div className={bodyClassName ?? "min-h-0 max-h-[75dvh] overflow-y-auto overscroll-contain"}>{children}</div>

        {footer && (
          <div
            className="border-t border-[var(--border)] px-6 py-4"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
