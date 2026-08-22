import { OrderStatus } from "@/types/pdv";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";

interface Props {
  status: OrderStatus;
  className?: string;
}

const MAP: Record<OrderStatus, { label: string; variant: BadgeVariant }> = {
  AGUARDANDO_CONFIRMACAO: { label: "Aguardando", variant: "warning" },
  AGUARDANDO_PAGAMENTO:   { label: "Aguardando pgto", variant: "warning" },
  NA_FILA:                { label: "Na fila", variant: "info" },
  PRONTO_PARCIAL:         { label: "Pronto parcial", variant: "warning" },
  PRONTO:                 { label: "Pronto", variant: "success" },
  SAIU_PARA_ENTREGA:      { label: "Saiu p/ entrega", variant: "info" },
  ENTREGUE:               { label: "Entregue", variant: "neutral" },
  CANCELADO:              { label: "Cancelado", variant: "destructive" },
  EXPIRADO:               { label: "Expirado", variant: "neutral" },
};

export function OrderStatusBadge({ status, className = "" }: Props) {
  const config = MAP[status] ?? MAP.EXPIRADO;
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
