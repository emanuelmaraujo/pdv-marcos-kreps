import { Badge } from "@/components/ui/Badge";
import { OrderStatus } from "@/types/pdv";

interface Props {
  status: OrderStatus;
  className?: string;
}

export function OrderStatusBadge({ status, className }: Props) {
  const map: Record<OrderStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" }> = {
    AGUARDANDO_CONFIRMACAO: { label: "Aguardando", variant: "secondary" },
    AGUARDANDO_PAGAMENTO: { label: "Aguard. Pgto", variant: "secondary" },
    NA_FILA: { label: "Na Fila", variant: "default" },
    PRONTO: { label: "Pronto", variant: "success" },
    ENTREGUE: { label: "Entregue", variant: "outline" },
    CANCELADO: { label: "Cancelado", variant: "destructive" },
    EXPIRADO: { label: "Expirado", variant: "outline" },
  };

  const config = map[status] || { label: status, variant: "outline" };
  return <Badge variant={config.variant} className={className}>{config.label}</Badge>;
}
