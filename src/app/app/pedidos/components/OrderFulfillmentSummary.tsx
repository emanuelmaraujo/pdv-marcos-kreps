import type { Order } from "@/types/pdv";
import { Bike, MapPin, ShoppingBag } from "lucide-react";

export function OrderFulfillmentSummary({ order }: { order: Order }) {
  if (order.type === "BALCAO") return null;

  if (order.type === "VIAGEM") {
    return (
      <section className="flex items-start gap-3 rounded-2xl border border-[var(--status-warning)]/25 bg-[var(--status-warning-bg)] p-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--status-warning)] text-white"><ShoppingBag size={18} /></span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--status-warning)]">Pedido para viagem</p>
          <p className="mt-0.5 text-sm font-black text-[var(--text-primary)]">Separar para retirada no balcão</p>
          <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">Confirme “Entregue” quando o cliente retirar.</p>
        </div>
      </section>
    );
  }

  const address = [order.delivery_street, order.delivery_number].filter(Boolean).join(", ");
  return (
    <section className="flex items-start gap-3 rounded-2xl border border-blue-500/25 bg-blue-500/10 p-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white"><Bike size={18} /></span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Pedido de entrega</p>
        <p className="mt-0.5 flex items-center gap-1 text-sm font-black text-[var(--text-primary)]"><MapPin size={13} className="shrink-0 text-blue-600" /><span className="truncate">{address || "Endereço a confirmar"}{order.delivery_neighborhood ? ` · ${order.delivery_neighborhood}` : ""}</span></p>
        <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">{order.courier_name ? `Entregador: ${order.courier_name}` : "Aguardando despacho para entregador"}</p>
      </div>
    </section>
  );
}
