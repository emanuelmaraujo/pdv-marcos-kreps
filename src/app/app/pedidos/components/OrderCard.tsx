import { ProductionHandoff } from './ProductionHandoff';
import { useState } from "react";
import { Order, OrderItemStatus } from "@/types/pdv";
import { Bike, CheckCircle2, Clock, CreditCard, Loader2, MapPin, Package, ShoppingBag, Utensils } from "lucide-react";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { CategoryLookup } from "./order-item-presentation";
import { deliveryNumberLabel, deliveryStreetName } from "@/lib/utils/order-delivery";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const ITEM_DOT: Record<OrderItemStatus, string> = { PENDING: "bg-[var(--text-muted)]/40", IN_PREPARATION: "bg-[var(--status-warning)]", READY: "bg-[var(--status-success)]", DELIVERED: "bg-[var(--status-success)] opacity-60", CANCELLED: "bg-[var(--bg-subtle)] ring-1 ring-[var(--border)]" };
const ACTIVE_STATUSES: Order["status"][] = ["NA_FILA", "AGUARDANDO_CONFIRMACAO", "AGUARDANDO_PAGAMENTO", "PRONTO_PARCIAL", "PRONTO", "SAIU_PARA_ENTREGA"];
const ACCENT: Record<Order["status"], string> = { AGUARDANDO_CONFIRMACAO: "bg-[var(--status-warning)]", AGUARDANDO_PAGAMENTO: "bg-[var(--status-warning)]", NA_FILA: "bg-[var(--status-info)]", PRONTO_PARCIAL: "bg-[var(--status-warning)]", PRONTO: "bg-[var(--status-success)]", SAIU_PARA_ENTREGA: "bg-blue-500", ENTREGUE: "bg-[var(--status-neutral)]", CANCELADO: "bg-[var(--status-danger)]", EXPIRADO: "bg-[var(--status-neutral)]" };

function OrderTypeBadge({ type }: { type: Order["type"] }) {
  const config = type === "ENTREGA" ? { label: "Entrega", Icon: Bike, className: "bg-blue-500/10 text-blue-600 ring-blue-500/25" } : type === "VIAGEM" ? { label: "Viagem", Icon: ShoppingBag, className: "bg-[var(--status-warning-bg)] text-[var(--status-warning)] ring-[var(--status-warning)]/25" } : { label: "Balcão", Icon: Utensils, className: "bg-[var(--bg-subtle)] text-[var(--text-secondary)] ring-[var(--border)]" };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ring-1 ${config.className}`}><config.Icon className="h-2.5 w-2.5" />{config.label}</span>;
}

function ElapsedTimer({ since, now }: { since: string; now: number }) {
  const minutes = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000));
  const color = minutes >= 20 ? "bg-[var(--status-danger-bg)] text-[var(--status-danger)]" : minutes >= 10 ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)]" : "bg-[var(--status-success-bg)] text-[var(--status-success)]";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}><Clock className="h-2.5 w-2.5" />{minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60}m`}</span>;
}

interface Props { order: Order; onClick: (order: Order) => void; now: number; categoryLookup?: CategoryLookup; onQuickAction?: (order: Order) => Promise<void>; onMarkDelivered?: (order: Order) => Promise<void>; onPay?: (order: Order) => void; onHandoffChanged?: (id: string) => void; handoffOffline?: boolean; }

export function OrderCard({ order, onClick, now, onQuickAction, onMarkDelivered, onPay, onHandoffChanged, handoffOffline = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const active = ACTIVE_STATUSES.includes(order.status);
  const pendingPayment = order.payment_status === "PENDING" || order.payment_status === "PARTIAL" || (order.items ?? []).some((item) => item.status !== "CANCELLED" && !["PAID", "COURTESY"].includes(item.payment_status));
  const pendingAmount = (order.items ?? []).filter((item) => item.status !== "CANCELLED" && !["PAID", "COURTESY"].includes(item.payment_status)).reduce((sum, item) => sum + Number(item.total_price ?? 0), 0) + (!order.paid_at ? Number(order.packing_fee ?? 0) + Number(order.delivery_fee ?? 0) : 0);
  const reopenedComanda = Boolean(order.paid_at) && (order.items ?? []).some((item) => item.status !== "CANCELLED" && !["PAID", "COURTESY"].includes(item.payment_status) && (item.addition_batch_no ?? 1) > 1);
  const since = order.queue_entered_at ?? order.confirmed_at;
  const elapsed = since ? Math.floor((now - new Date(since).getTime()) / 60_000) : 0;
  const urgent = active && elapsed >= 20;
  const activeItems = (order.items ?? []).filter((item) => item.status !== "CANCELLED");
  const readyItems = activeItems.filter((item) => ["READY", "DELIVERED"].includes(item.status)).length;
  const nextAction = order.status === "AGUARDANDO_CONFIRMACAO"
    ? { label: "Confirmar pedido", Icon: CheckCircle2, color: "bg-[var(--status-success)] text-white hover:opacity-90", run: () => onQuickAction?.(order) }
    : order.status === "NA_FILA"
      ? { label: "Marcar pronto", Icon: Package, color: "bg-brand-amber text-brand-charcoal hover:bg-brand-amber/90", run: () => onQuickAction?.(order) }
      : order.status === "PRONTO_PARCIAL"
        ? { label: "Ver itens prontos", Icon: Package, color: "bg-[var(--status-warning)] text-white hover:opacity-90", run: () => onClick(order) }
        : order.status === "PRONTO" && order.type === "ENTREGA"
          ? { label: "Despachar", Icon: Bike, color: "bg-blue-500 text-white hover:bg-blue-600", run: () => onClick(order) }
          : order.status === "PRONTO"
            ? { label: "Entregar", Icon: CheckCircle2, color: "bg-[var(--status-success)] text-white hover:opacity-90", run: () => onQuickAction?.(order) }
            : null;
  const awaitingCourier = order.status === "SAIU_PARA_ENTREGA";
  const canDeliverFromQueue = !!onMarkDelivered && order.status === "NA_FILA" && order.type !== "ENTREGA";
  const triggerAction = async (event: React.MouseEvent) => { event.stopPropagation(); if (!nextAction || loading) return; setLoading(true); try { await nextAction.run(); } finally { setLoading(false); } };
  const triggerDeliver = async (event: React.MouseEvent) => { event.stopPropagation(); if (!onMarkDelivered || delivering) return; setDelivering(true); try { await onMarkDelivered(order); } finally { setDelivering(false); } };
  const triggerPayment = (event: React.MouseEvent) => { event.stopPropagation(); if (!onPay || loading) return; onPay(order); };
  return <article className={`focus-ring relative scroll-mt-20 overflow-hidden rounded-2xl border bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] transition ${urgent ? "border-[var(--status-danger)]/50 ring-2 ring-[var(--status-danger)]/15" : "border-[var(--border)]"} ${loading || delivering ? "pointer-events-none opacity-60" : "hover:shadow-[var(--shadow-md)]"}`}>
    <div className={`h-1 ${ACCENT[order.status]}`} />
    <div className="space-y-3 p-3.5">
      <header className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><button type="button" onClick={() => onClick(order)} aria-label={`Abrir detalhes do pedido ${order.daily_number} de ${order.customer_name || 'Cliente final'}`} className="min-h-11 w-full break-words text-left text-xl font-extrabold leading-tight text-[var(--text-primary)]">{order.customer_name || 'Cliente final'}</button><p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">#{String(order.daily_number).padStart(3, '0')} · {order.branch?.name || order.branch?.code || 'Filial'}</p><div className="mt-2 flex flex-wrap items-center gap-1"><OrderTypeBadge type={order.type} /><OrderStatusBadge status={order.status} />{active && since && <ElapsedTimer since={since} now={now} />}</div></div><PaymentStatusBadge status={pendingPayment ? 'PARTIAL' : order.payment_status} /></header>
      {order.type === "VIAGEM" && <div className="flex items-center gap-2 rounded-xl border border-[var(--status-warning)]/25 bg-[var(--status-warning-bg)] px-3 py-2 text-[11px] font-black uppercase tracking-wide text-[var(--status-warning)]"><ShoppingBag className="h-3.5 w-3.5" />Para viagem · separar para retirada</div>}
      {order.type === "ENTREGA" && <div className="flex items-start gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 px-3 py-2 text-blue-700"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><div className="min-w-0"><p className="truncate text-[11px] font-black uppercase tracking-wide">{deliveryStreetName(order)} · {deliveryNumberLabel(order)}</p>{order.delivery_neighborhood && <p className="mt-0.5 truncate text-[10px] font-semibold text-blue-700/75">{order.delivery_neighborhood}</p>}</div></div>}
      {pendingPayment && <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--bg-subtle)] px-3 py-2 text-xs font-bold text-[var(--text-primary)]"><span>{reopenedComanda ? "Adicional a receber" : `Pagamento ${order.payment_status === "PARTIAL" ? "parcial" : "pendente"}`}</span><span className="tabular-nums">{currency.format(pendingAmount || order.total_amount)}</span></div>}
      {awaitingCourier && <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-700"><Bike className="h-3.5 w-3.5" /><span className="truncate">Aguardando confirmação de {order.courier_name || "motoboy"}</span></div>}
      {(order.items ?? []).length > 0 && <ProductionHandoff order={order} onChanged={onHandoffChanged} offline={handoffOffline} />}
      {activeItems.length > 1 && <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-subtle)] px-2.5 py-1.5"><span className="text-[11px] font-semibold text-[var(--text-secondary)]">{readyItems}/{activeItems.length} linhas prontas</span><div className="flex flex-1 flex-wrap gap-1">{activeItems.map((item) => <span key={item.id} className={`h-2 w-2 rounded-full ${ITEM_DOT[item.status]}`} />)}</div></div>}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5"><div><p className="text-[10px] font-medium text-[var(--text-muted)]">Total do pedido</p><p className="text-base font-black tabular-nums text-[var(--text-primary)]">{currency.format(order.total_amount)}</p></div><div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">{pendingPayment && onPay && <button type="button" onClick={triggerPayment} className="flex h-11 items-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 text-xs font-black text-[var(--text-primary)] active:scale-95"><CreditCard className="h-3.5 w-3.5" />Receber</button>}{canDeliverFromQueue && <button type="button" onClick={triggerDeliver} className="flex h-11 items-center gap-1.5 rounded-xl bg-[var(--status-success)] px-3 text-xs font-black text-white shadow-sm active:scale-95">{delivering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}Entregar</button>}{nextAction && <button type="button" onClick={triggerAction} className={`flex h-11 max-w-[210px] items-center gap-1.5 rounded-xl px-3 text-xs font-black shadow-sm active:scale-95 ${nextAction.color}`}>{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <nextAction.Icon className="h-3.5 w-3.5" />}{nextAction.label}</button>}</div></footer>
    </div>
  </article>;
}
