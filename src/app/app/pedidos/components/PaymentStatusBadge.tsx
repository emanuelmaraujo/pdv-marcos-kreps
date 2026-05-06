import { PaymentStatus } from "@/types/pdv";

interface Props {
  status: PaymentStatus;
  className?: string;
}

export function PaymentStatusBadge({ status, className = "" }: Props) {
  const map: Record<PaymentStatus, { label: string; classes: string }> = {
    PENDING: { 
      label: "Pendente", 
      classes: "bg-brand-amber text-brand-charcoal border-brand-amber shadow-sm" 
    },
    PAID: { 
      label: "Pago", 
      classes: "bg-emerald-500 text-white border-emerald-500 shadow-sm" 
    },
    REFUNDED: { 
      label: "Estornado", 
      classes: "bg-zinc-100 text-zinc-500 border-zinc-200" 
    },
    CANCELED: { 
      label: "Cancelado", 
      classes: "bg-red-500 text-white border-red-500" 
    },
    COURTESY: { 
      label: "Cortesia", 
      classes: "bg-brand-charcoal text-white border-brand-charcoal" 
    },
  };

  const config = map[status] || { label: status, classes: "bg-zinc-100 text-zinc-500 border-zinc-200" };
  
  return (
    <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest inline-flex items-center justify-center ${config.classes} ${className}`}>
      {config.label}
    </span>
  );
}
