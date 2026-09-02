import type { Order } from "@/types/pdv";
import { Bike, MapPin, Navigation, Phone, ShoppingBag } from "lucide-react";

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
  const locality = [order.delivery_neighborhood, order.delivery_city, order.delivery_state].filter(Boolean).join(" · ");
  return (
    <section className="overflow-hidden rounded-2xl border border-blue-500/25 bg-blue-500/[0.07]">
      <div className="flex items-start gap-3 p-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white shadow-sm"><Bike size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Entrega</p>
          <p className="mt-0.5 flex items-start gap-1.5 text-sm font-black leading-snug text-[var(--text-primary)]"><MapPin size={14} className="mt-0.5 shrink-0 text-blue-600" /><span>{address || "Endereço a confirmar"}</span></p>
          {locality && <p className="mt-1 pl-5 text-xs font-semibold text-[var(--text-secondary)]">{locality}</p>}
          {order.delivery_complement && <p className="mt-1 pl-5 text-xs font-semibold text-[var(--text-secondary)]">{order.delivery_complement}</p>}
        </div>
      </div>
      {(order.delivery_reference || order.courier_name || order.courier_phone) && (
        <div className="space-y-2 border-t border-blue-500/15 bg-white/40 px-3.5 py-3">
          {order.delivery_reference && <p className="flex gap-2 text-xs font-semibold text-[var(--text-secondary)]"><Navigation size={14} className="shrink-0 text-blue-600" /><span><strong className="text-[var(--text-primary)]">Referência:</strong> {order.delivery_reference}</span></p>}
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--text-secondary)]">
            <span>{order.courier_name ? <><strong className="text-[var(--text-primary)]">Entregador:</strong> {order.courier_name}</> : "Aguardando despacho para entregador"}</span>
            {order.courier_phone && <a href={`tel:${order.courier_phone}`} className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-500 px-2 py-1 font-black text-white"><Phone size={12} /> Ligar</a>}
          </div>
        </div>
      )}
    </section>
  );
}
