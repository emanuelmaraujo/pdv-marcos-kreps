import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Conteúdo fixo fora da área de rolagem (ex: botão "Adicionar ao carrinho").
   * Fica sempre visível, mesmo com o corpo rolando ou o teclado aberto. */
  footer?: React.ReactNode;
}

/** Arrasta pra baixo pra fechar — só no header/handle (não compete com o
 * scroll do conteúdo). Cancela abaixo do limiar, fecha acima dele. */
function useDragToClose(onClose: () => void) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef<number | null>(null);
  const deltaYRef = useRef(0);
  const draggingRef = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    draggingRef.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!draggingRef.current || startYRef.current === null || !sheetRef.current) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta <= 0) return;
    deltaYRef.current = delta;
    sheetRef.current.style.transform = `translateY(${delta}px)`;
  };

  const onTouchEnd = () => {
    if (!draggingRef.current || !sheetRef.current) return;
    draggingRef.current = false;
    const shouldClose = deltaYRef.current > 90;
    sheetRef.current.style.transition = 'transform 200ms ease-out';
    sheetRef.current.style.transform = '';
    window.setTimeout(() => { sheetRef.current?.style.removeProperty('transition'); }, 200);
    startYRef.current = null;
    deltaYRef.current = 0;
    if (shouldClose) onClose();
  };

  return { sheetRef, onTouchStart, onTouchMove, onTouchEnd };
}

export function BottomSheet({ isOpen, onClose, title, children, footer }: DialogProps) {
  const { sheetRef, onTouchStart, onTouchMove, onTouchEnd } = useDragToClose(onClose);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

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
    const keepFocusedFieldVisible = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      window.setTimeout(() => {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 80);
    };

    updateKeyboardInset();
    viewport?.addEventListener("resize", updateKeyboardInset);
    viewport?.addEventListener("scroll", updateKeyboardInset);
    document.addEventListener("focusin", keepFocusedFieldVisible);

    return () => {
      viewport?.removeEventListener("resize", updateKeyboardInset);
      viewport?.removeEventListener("scroll", updateKeyboardInset);
      document.removeEventListener("focusin", keepFocusedFieldVisible);
    };
  }, [isOpen, sheetRef]);

  if (!isOpen || typeof document === 'undefined') return null;

  // A folha pode ser chamada de dentro de barras com `backdrop-filter` ou
  // `transform`, que criam um contexto de empilhamento e quebram `fixed`.
  // Portal para o body garante que o backdrop e os selects fiquem clicáveis
  // acima de qualquer cabeçalho, modal ou navegação da página.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center pb-[calc(4rem+env(safe-area-inset-bottom))] sm:items-center sm:pb-0">
      {/* Backdrop - Only covers area above menu */}
      <div
        className="fixed inset-0 bg-zinc-900/45 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet Content — coluna flex: header e footer fixos, só o meio rola.
         max-height em dvh garante que cabe na viewport real do mobile
         (barra de endereço / teclado não empurram o footer pra fora). */}
      <div
        ref={sheetRef}
        className="relative z-[75] flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xl transform-gpu transition-transform will-change-transform animate-in slide-in-from-bottom duration-300 sm:rounded-2xl"
        style={{
          maxHeight: 'calc(100dvh - 4rem - env(safe-area-inset-bottom) - var(--keyboard-inset, 0px))',
          marginBottom: 'var(--keyboard-inset, 0px)',
        }}
      >
        <div
          className="shrink-0 touch-none border-b border-[var(--border)]"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Handle de arraste — só mobile, sinaliza que dá pra arrastar pra fechar */}
          <div className="flex justify-center pt-2 pb-1 sm:hidden">
            <span className="h-1 w-10 rounded-full bg-[var(--border-strong)]" />
          </div>
          <div className="flex items-center justify-between px-6 py-3">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="focus-ring relative -mr-2 rounded-full p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] after:absolute after:inset-[-8px] after:content-['']"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Única área com rolagem */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>

        {footer && (
          <div
            className="shrink-0"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
