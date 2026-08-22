import { PaymentStatus } from "@/types/pdv";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";

interface Props {
  status: PaymentStatus;
  className?: string;
}

const MAP: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
  PENDING:   { label: "Pendente", variant: "warning" },
  PARTIAL:   { label: "Parcial", variant: "info" },
  PAID:      { label: "Pago", variant: "success" },
  REFUNDED:  { label: "Estornado", variant: "neutral" },
  CANCELED:  { label: "Cancelado", variant: "destructive" },
  COURTESY:  { label: "Cortesia", variant: "brand" },
};

export function PaymentStatusBadge({ status, className = "" }: Props) {
  const config = MAP[status] ?? MAP.PENDING;
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
