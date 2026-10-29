"use client";

import { CheckCircle2 } from "lucide-react";

/** Progress indicator das telas pós-cardápio (#235: 3 passos visíveis).
 * Sacola (0), Dados (1), Pagamento (2). A confirmação não mostra progresso. */
export function ProgressSteps({ current }: { current: 0 | 1 | 2 }) {
  const steps = ["Sacola", "Dados", "Pagamento"];
  return (
    <nav aria-label="Progresso do pedido" className="flex items-center gap-1 sm:gap-2">
      {steps.map((label, i) => {
        const isDone = i < current;
        const isCurrent = i === current;
        return (
          <div key={label} className={`flex items-center gap-1.5 sm:gap-2 ${i < steps.length - 1 ? "flex-1" : ""}`} aria-current={isCurrent ? "step" : undefined}>
            <div className="flex shrink-0 items-center gap-1.5">
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
                title={label}
                className={`whitespace-nowrap text-xs ${
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
