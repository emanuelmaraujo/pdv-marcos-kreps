import type { ElementType, ReactNode } from "react";

export function SettingsPageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  action,
  meta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ElementType;
  action?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-[var(--elevation-1)] sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red ring-1 ring-brand-red/15">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-red">{eyebrow}</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">{title}</h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
            {meta ? <div className="mt-3 flex flex-wrap gap-2">{meta}</div> : null}
          </div>
        </div>
        {action ? <div className="shrink-0 sm:pt-1">{action}</div> : null}
      </div>
    </header>
  );
}

export function SettingsBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "info" }) {
  const styles = {
    neutral: "bg-[var(--bg-subtle)] text-[var(--text-secondary)]",
    success: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
    warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
    info: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  };
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[tone]}`}>{children}</span>;
}
