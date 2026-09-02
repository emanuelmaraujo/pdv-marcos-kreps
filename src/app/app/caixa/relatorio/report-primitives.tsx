"use client";

import type { ComponentProps, ElementType, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card as BaseCard } from "@/components/ui/Card";

type PanelTone = "default" | "success" | "warning" | "danger" | "dark";
type MetricTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const panelTone: Record<PanelTone, string> = {
  default: "border-[var(--border)] bg-[var(--bg-surface)]",
  success: "border-emerald-500/25 bg-emerald-500/[0.035]",
  warning: "border-amber-500/30 bg-amber-500/[0.045]",
  danger: "border-red-500/25 bg-red-500/[0.035]",
  dark: "border-transparent bg-[var(--bg-inverse)] text-white",
};

const metricTone: Record<MetricTone, { wrap: string; icon: string; value: string }> = {
  neutral: { wrap: "bg-[var(--bg-subtle)]", icon: "bg-[var(--bg-surface)] text-[var(--text-secondary)]", value: "text-[var(--text-primary)]" },
  brand:   { wrap: "bg-brand-red/[0.055]", icon: "bg-brand-red/10 text-brand-red", value: "text-brand-red" },
  success: { wrap: "bg-emerald-500/[0.07]", icon: "bg-emerald-500/10 text-emerald-700", value: "text-emerald-700" },
  warning: { wrap: "bg-amber-500/[0.09]", icon: "bg-amber-500/10 text-amber-700", value: "text-amber-700" },
  danger:  { wrap: "bg-red-500/[0.07]", icon: "bg-red-500/10 text-red-700", value: "text-red-700" },
  info:    { wrap: "bg-blue-500/[0.07]", icon: "bg-blue-500/10 text-blue-700", value: "text-blue-700" },
};

export function ReportPanel({
  children, className = "", tone = "default", ...props
}: ComponentProps<typeof BaseCard> & { tone?: PanelTone }) {
  return (
    <BaseCard {...props} className={`report-panel overflow-hidden rounded-[18px] border shadow-none ${panelTone[tone]} ${className}`}>
      {children}
    </BaseCard>
  );
}

export function MetricTile({
  label, value, icon: Icon, tone = "neutral", meta, trend, className = "",
}: {
  label: string;
  value: string;
  icon?: ElementType;
  tone?: MetricTone;
  meta?: ReactNode;
  trend?: number | null;
  className?: string;
}) {
  const style = metricTone[tone];
  const direction = trend == null || trend === 0 ? "flat" : trend > 0 ? "up" : "down";
  const TrendIcon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  return (
    <article className={`metric-tile rounded-2xl p-3.5 ${style.wrap} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[var(--text-muted)]">{label}</p>
        {Icon && <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${style.icon}`}><Icon className="h-3.5 w-3.5" strokeWidth={1.8} /></span>}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <p className={`text-xl font-semibold leading-none tracking-tight tabular-nums ${style.value}`}>{value}</p>
        {trend != null && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${direction === "up" ? "text-emerald-700" : direction === "down" ? "text-red-700" : "text-[var(--text-muted)]"}`}>
            <TrendIcon className="h-3 w-3" />{Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      {meta && <div className="analytics-detail mt-2 text-[11px] font-medium leading-snug text-[var(--text-muted)]">{meta}</div>}
    </article>
  );
}

export function ReportSectionHeading({
  eyebrow, title, trailing,
}: { eyebrow?: string; title: string; trailing?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-red">{eyebrow}</p>}
        <h2 className="mt-1 text-title font-semibold text-[var(--text-primary)]">{title}</h2>
      </div>
      {trailing}
    </div>
  );
}
