import type { ElementType, ReactNode } from "react";

export interface SettingsPanelAccent {
  iconBg: string;
  iconColor: string;
}

const DEFAULT_ACCENT: SettingsPanelAccent = { iconBg: "bg-[var(--bg-subtle)]", iconColor: "text-[var(--text-secondary)]" };

export function SettingsPanel({
  id,
  icon: Icon,
  title,
  description,
  accent = DEFAULT_ACCENT,
  className = "",
  children,
}: {
  id: string;
  icon: ElementType;
  title: string;
  description: string;
  accent?: SettingsPanelAccent;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--elevation-1)] ${className}`}
    >
      <header className="flex items-center gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent.iconBg}`}>
          <Icon className={`h-5 w-5 ${accent.iconColor}`} />
        </span>
        <span className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">{title}</h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{description}</p>
        </span>
      </header>
      <div className="border-t border-[var(--border)] px-4 py-5 sm:px-6">{children}</div>
    </section>
  );
}
