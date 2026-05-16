import { OrderStatus } from "@/types/pdv";

interface Props {
  status: OrderStatus;
  className?: string;
}

export function OrderStatusBadge({ status, className = "" }: Props) {
  const map: Record<OrderStatus, { label: string; classes: string }> = {
    AGUARDANDO_CONFIRMACAO: { 
      label: "Aguardando", 
      classes: "bg-blue-50 text-blue-600 border-blue-100" 
    },
    AGUARDANDO_PAGAMENTO: { 
      label: "Aguardando pgto", 
      classes: "bg-brand-amber/10 text-brand-amber border-brand-amber/20" 
    },
    NA_FILA: {
      label: "Na Fila",
      classes: "bg-brand-red/10 text-brand-red border-brand-red/20"
    },
    PRONTO_PARCIAL: {
      label: "Pronto Parcial",
      classes: "bg-amber-100 text-amber-700 border-amber-300"
    },
    PRONTO: {
      label: "Pronto",
      classes: "bg-emerald-50 text-emerald-600 border-emerald-100"
    },
    ENTREGUE: { 
      label: "Entregue", 
      classes: "bg-zinc-100 text-zinc-500 border-zinc-200" 
    },
    CANCELADO: { 
      label: "Cancelado", 
      classes: "bg-red-50 text-red-500 border-red-100" 
    },
    EXPIRADO: { 
      label: "Expirado", 
      classes: "bg-zinc-100 text-zinc-400 border-zinc-200" 
    },
  };

  const config = map[status] || { label: status, classes: "bg-zinc-100 text-zinc-500 border-zinc-200" };
  
  return (
    <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider inline-flex items-center justify-center ${config.classes} ${className}`}>
      {config.label}
    </span>
  );
}
