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
      className={`scroll-mt-6 overflow-hidden rounded-3xl bg-[var(--bg-surface)] shadow-sm ring-1 ring-[var(--border)] ${className}`}
    >
      <header className="flex items-center gap-4 px-6 py-5">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${accent.iconBg} ring-1 ring-black/5`}>
          <Icon className={`h-5 w-5 ${accent.iconColor}`} />
        </span>
        <span className="min-w-0 flex-1">
          <h2 className="text-sm font-black text-[var(--text-primary)]">{title}</h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{description}</p>
        </span>
      </header>
      <div className="border-t border-[var(--border)] px-6 py-5">{children}</div>
    </section>
  );
}
