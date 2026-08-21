import type { ReactNode } from "react";

export function ToggleRow({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="group flex w-full items-start justify-between gap-5 py-4 text-left"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-secondary)] transition-colors">{label}</span>
        {description && (
          <span className="mt-1 block text-xs leading-relaxed text-[var(--text-muted)]">{description}</span>
        )}
      </span>
      <span
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-all duration-300 ${
          checked ? "bg-brand-red shadow-md shadow-brand-red/25" : "bg-[var(--border-strong)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-300 ${
            checked ? "translate-x-5 shadow-md" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function ToggleGroup({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)]/60 px-4">
      {children}
    </div>
  );
}
