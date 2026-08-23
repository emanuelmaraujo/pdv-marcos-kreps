import type { ElementType, ReactNode } from "react";

export function Field({
  label, hint, required, error, children,
}: {
  label: string; hint?: string; required?: boolean; error?: string; children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex flex-wrap items-baseline gap-1 text-[10.5px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
        {label}
        {required && <span className="text-brand-red">*</span>}
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
      className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm transition-all ${
        checked
          ? 'border-[var(--status-success)]/25 bg-[var(--status-success-bg)]'
          : 'border-[var(--border)] bg-[var(--bg-subtle)] hover:border-[var(--border-strong)]'
      } ${small ? '' : 'w-full'}`}
    >
      <div className="min-w-0">
        <p className={`font-bold text-[var(--text-primary)] ${small ? 'text-[11px]' : 'text-xs'}`}>{label}</p>
        {desc && <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--text-secondary)]">{desc}</p>}
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
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/**
 * Card com título discreto — agrupa um cluster de campos relacionados dentro
 * de uma aba. Com `icon`, o título vira um cabeçalho maior com avatar
 * colorido (mesmo padrão usado nas zonas/entregadores/setores) em vez do
 * rótulo minúsculo em caixa alta.
 */
export function FieldGroup({
  title, subtitle, description, icon: Icon, iconBg = "bg-[var(--bg-subtle)]", iconColor = "text-[var(--text-muted)]", action, children,
}: {
  title?: string;
  /** Rótulo curto em caixa alta (ex: nome do setor/código). */
  subtitle?: string;
  /** Frase descritiva normal, menor e discreta (ex: "dispara quando..."). */
  description?: string;
  icon?: ElementType;
  iconBg?: string;
  iconColor?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm transition-shadow hover:shadow-md">
      {title && !Icon && <p className="text-[10.5px] font-black uppercase tracking-wider text-[var(--text-muted)]">{title}</p>}
      {title && Icon && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
              <Icon className={`h-4 w-4 ${iconColor}`} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-[var(--text-primary)]">{title}</p>
              {subtitle && <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{subtitle}</p>}
              {description && <p className="truncate text-[10px] text-[var(--text-muted)]">{description}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
