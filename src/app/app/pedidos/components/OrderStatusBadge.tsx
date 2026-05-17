import { OrderStatus } from "@/types/pdv";

interface Props {
  status: OrderStatus;
  className?: string;
}

const MAP: Record<OrderStatus, { label: string; classes: string }> = {
  AGUARDANDO_CONFIRMACAO: {
    label: "Aguardando",
    classes: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  },
  AGUARDANDO_PAGAMENTO: {
    label: "Aguardando pgto",
    classes: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  },
  NA_FILA: {
    label: "Na fila",
    classes: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  },
  PRONTO_PARCIAL: {
    label: "Pronto parcial",
    classes: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  },
  PRONTO: {
    label: "Pronto",
    classes: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
  },
  ENTREGUE: {
    label: "Entregue",
    classes: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]",
  },
  CANCELADO: {
    label: "Cancelado",
    classes: "bg-[var(--status-danger-bg)] text-[var(--status-danger)]",
  },
  EXPIRADO: {
    label: "Expirado",
    classes: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]",
  },
};

export function OrderStatusBadge({ status, className = "" }: Props) {
  const config = MAP[status] ?? MAP.EXPIRADO;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${config.classes} ${className}`}
    >
      {config.label}
    </span>
  );
}
