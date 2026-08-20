"use client";

import { CheckCircle2 } from "lucide-react";

/** Item de timeline vertical na tela de acompanhamento. */
export function TimelineStep({
  label,
  done,
  active,
  isLast,
}: { label: string; done?: boolean; active?: boolean; isLast?: boolean }) {
  return (
    <li className="relative flex items-start gap-3">
      <div className="flex flex-col items-center">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            done
              ? ""
              : active
                ? "bg-brand-red text-white"
                : "border-2 border-[var(--border-strong)]"
          }`}
          style={done ? { backgroundColor: "var(--status-success)", color: "white" } : undefined}
        >
          {done && <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />}
          {active && <span className="h-2 w-2 rounded-full bg-white animate-pulse" />}
        </span>
        {!isLast && (
          <span
            className={`mt-1 h-6 w-px ${done ? "bg-[var(--status-success)]" : "bg-[var(--border)]"}`}
            aria-hidden
          />
        )}
      </div>
      <span
        className={`text-sm pt-0.5 ${
          done
            ? "text-[var(--text-primary)] font-medium"
            : active
              ? "font-semibold text-[var(--text-primary)]"
              : "text-[var(--text-muted)]"
        }`}
      >
        {label}
      </span>
    </li>
  );
}
