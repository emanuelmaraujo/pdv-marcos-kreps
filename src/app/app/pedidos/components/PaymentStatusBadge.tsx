import { PaymentStatus } from "@/types/pdv";

interface Props {
  status: PaymentStatus;
  className?: string;
}

const MAP: Record<PaymentStatus, { label: string; classes: string }> = {
  PENDING: {
    label: "Pendente",
    classes: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  },
  PARTIAL: {
    label: "Parcial",
    classes: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  },
  PAID: {
    label: "Pago",
    classes: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
  },
  REFUNDED: {
    label: "Estornado",
    classes: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]",
  },
  CANCELED: {
    label: "Cancelado",
    classes: "bg-[var(--status-danger-bg)] text-[var(--status-danger)]",
  },
  COURTESY: {
    label: "Cortesia",
    classes: "bg-brand-charcoal text-white",
  },
};

export function PaymentStatusBadge({ status, className = "" }: Props) {
  const config = MAP[status] ?? MAP.PENDING;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${config.classes} ${className}`}
    >
      {config.label}
    </span>
  );
}
