import type { ReactNode } from "react";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
      {children}
      {hint && <span className="block text-[11px] leading-relaxed text-[var(--text-muted)]">{hint}</span>}
    </label>
  );
}
