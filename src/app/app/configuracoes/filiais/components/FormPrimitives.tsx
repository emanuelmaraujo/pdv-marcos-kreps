import type { ReactNode } from "react";

export function Field({
  label, hint, required, error, children,
}: {
  label: string; hint?: string; required?: boolean; error?: string; children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline gap-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
        {label}
        {required && <span className="text-[var(--status-danger)]">*</span>}
        {hint && <span className="text-[10px] font-medium normal-case text-[var(--text-muted)]">— {hint}</span>}
      </span>
      {children}
      {error && <p className="mt-1 text-[10px] font-bold text-[var(--status-danger)]">{error}</p>}
    </label>
  );
}

export function Toggle({
  label, desc, checked, onChange, small = false,
}: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void; small?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
        checked
          ? 'border-[var(--status-success)]/30 bg-[var(--status-success-bg)]'
          : 'border-[var(--border)] bg-[var(--bg-subtle)]'
      } ${small ? '' : 'w-full'}`}
    >
      <div className="min-w-0">
        <p className={`font-bold text-[var(--text-primary)] ${small ? 'text-[11px]' : 'text-xs'}`}>{label}</p>
        {desc && <p className="text-[10px] leading-tight text-[var(--text-secondary)]">{desc}</p>}
      </div>
      <SwitchKnob checked={checked} onChange={onChange} />
    </label>
  );
}

/** Switch estilizado tipo iOS — substitui o checkbox cru por algo moderno. */
export function SwitchKnob({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:ring-offset-2 focus:ring-offset-[var(--bg-surface)] ${
        checked ? 'bg-[var(--status-success)]' : 'bg-[var(--border-strong)]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
