"use client";

import { CheckCircle2 } from "lucide-react";

/** Progress indicator no topo das telas pós-cardápio.
 * 5 steps: Cardápio (0), Itens (1), Dados (2), Pagamento (3), Pronto (4). */
export function ProgressSteps({ current }: { current: 0 | 1 | 2 | 3 | 4 }) {
  const steps = ["Cardápio", "Itens", "Dados", "Pagamento", "Pronto"];
  return (
    <nav aria-label="Progresso do pedido" className="flex items-center gap-2">
      {steps.map((label, i) => {
        const isDone = i < current;
        const isCurrent = i === current;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-caption font-semibold ${
                  isDone
                    ? "bg-brand-red text-white"
                    : isCurrent
                      ? "bg-brand-red text-white shadow-[var(--shadow-sm)]"
                      : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                }`}
              >
                {isDone ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} /> : i + 1}
              </span>
              <span
                className={`text-xs truncate ${
                  isCurrent
                    ? "font-semibold text-[var(--text-primary)]"
                    : isDone
                      ? "font-medium text-[var(--text-secondary)]"
                      : "text-[var(--text-muted)]"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className={`h-px flex-1 ${i < current ? "bg-brand-red" : "bg-[var(--border)]"}`} aria-hidden />
            )}
          </div>
        );
      })}
    </nav>
  );
}
