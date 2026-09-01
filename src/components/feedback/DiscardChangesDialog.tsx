"use client";

interface DiscardChangesDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onDiscard: () => void;
}

export function DiscardChangesDialog({
  isOpen,
  title,
  description,
  onCancel,
  onDiscard,
}: DiscardChangesDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:items-center">
      <button
        type="button"
        aria-label="Continuar editando"
        className="absolute inset-0 bg-zinc-950/55"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-changes-title"
        className="relative w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-2xl"
      >
        <h2 id="discard-changes-title" className="text-base font-black text-[var(--text-primary)]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          {description}
        </p>
        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-xl border-2 border-[var(--border)] px-4 text-sm font-black text-[var(--text-primary)]"
          >
            Continuar editando
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="min-h-12 rounded-xl bg-[var(--status-danger)] px-4 text-sm font-black text-white"
          >
            Descartar alterações
          </button>
        </div>
      </div>
    </div>
  );
}
