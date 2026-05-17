import * as React from "react"

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "neutral"
  | "brand";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

const variants: Record<BadgeVariant, string> = {
  // Vermelho sólido — reservar para destaques de marca / contagens críticas
  default:     "border-transparent bg-brand-red text-white",
  // Cinza neutro
  secondary:   "border-transparent bg-[var(--bg-subtle)] text-[var(--text-secondary)]",
  // Erro / cancelamento
  destructive: "border-transparent bg-[var(--status-danger-bg)] text-[var(--status-danger)]",
  // Outline limpo (cinza)
  outline:     "border-[var(--border)] bg-white text-[var(--text-secondary)]",
  // Status semânticos
  success:     "border-transparent bg-[var(--status-success-bg)] text-[var(--status-success)]",
  warning:     "border-transparent bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  info:        "border-transparent bg-[var(--status-info-bg)] text-[var(--status-info)]",
  neutral:     "border-transparent bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]",
  // Brand escuro (charcoal) — números de pedido, chips de identidade
  brand:       "border-transparent bg-brand-charcoal text-white",
};

export function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  const baseStyle =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold " +
    "focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:ring-offset-2";

  return (
    <div className={`${baseStyle} ${variants[variant]} ${className}`} {...props} />
  );
}
