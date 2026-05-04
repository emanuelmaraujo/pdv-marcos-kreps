import { Badge } from "@/components/ui/Badge";
import { PaymentStatus } from "@/types/pdv";

interface Props {
  status: PaymentStatus;
  className?: string;
}

export function PaymentStatusBadge({ status, className }: Props) {
  const map: Record<PaymentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" }> = {
    PENDING: { label: "Pendente", variant: "destructive" },
    PAID: { label: "Pago", variant: "success" },
    REFUNDED: { label: "Reembolsado", variant: "outline" },
    CANCELED: { label: "Cancelado", variant: "secondary" },
    COURTESY: { label: "Cortesia", variant: "default" },
  };

  const config = map[status] || { label: status, variant: "outline" };
  // Overriding destructive color slightly for pending to be amber instead of red to be less scary
  const customClass = status === 'PENDING' ? 'bg-amber-500 hover:bg-amber-600 border-transparent text-white' : '';
  
  return <Badge variant={config.variant} className={`${customClass} ${className || ''}`}>{config.label}</Badge>;
}
