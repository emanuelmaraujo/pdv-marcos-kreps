import { Order, PaymentMethod } from "@/types/pdv";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { OrderItemsControl } from "./OrderItemsControl";
import { PayItemsModal } from "./PayItemsModal";
import { EditOrderItemSheet } from "./EditOrderItemSheet";
import { OrderFulfillmentSummary } from "./OrderFulfillmentSummary";
import { CategoryLookup } from "./order-item-presentation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  formatDuration,
  formatOrderTime as fmt,
  minutesBetween,
  ORDER_DETAILS_PAYMENT_METHOD_BY_VALUE as PAYMENT_METHOD_CONFIG,
  getOutstandingOrderAmount,
  additionWindowRemainingMinutes,
  isOrderOpenForAdditions,
  orderCurrency as currency,
  useOrderDetailsActions,
} from "./order-details-shared";
import {
  PlusCircle,
  Printer,
  CheckCircle2,
  Package,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Utensils,
  ShoppingBag,
  Bike,
  Clock,
  ChevronDown,
  ChevronUp,
  History,
  CircleDollarSign,
  MessageSquareText,
  ReceiptText,
} from "lucide-react";

interface Props {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: () => void | Promise<void>;
  categoryLookup?: CategoryLookup;
}

function TimelineStep({
  label,
  time,
  active,
  done,
}: {
  label: string;
  time?: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-1 ${done ? "opacity-100" : active ? "opacity-100" : "opacity-30"}`}>
      <div
        className={`h-2.5 w-2.5 rounded-full border-2 transition-all ${
          done
            ? "border-emerald-500 bg-emerald-500"
            : active
            ? "border-brand-red bg-brand-red ring-4 ring-brand-red/20"
            : "border-[var(--border-strong)] bg-white"
        }`}
      />
      <p className="text-[9px] font-black uppercase tracking-wide text-[var(--text-muted)] text-center leading-tight whitespace-nowrap">
        {label}
      </p>
      {time && <p className="text-[9px] font-bold text-[var(--text-muted)]">{time}</p>}
    </div>
  );
}

function TimelineConnector({ done }: { done: boolean }) {
  return (
    <div className={`flex-1 h-0.5 rounded-full transition-colors ${done ? "bg-emerald-300" : "bg-white/15"}`} />
  );
}

function TimeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-black text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function OrderActionBrief({
  order,
  isDelivery,
  hasOutstandingPayment,
  outstandingAmount,
}: {
  order: Order;
  isDelivery: boolean;
  hasOutstandingPayment: boolean;
  outstandingAmount: number;
}) {
  const content = hasOutstandingPayment
    ? {
        eyebrow: "Prioridade financeira",
        title: `Receber ${currency.format(outstandingAmount)}`,
        description: "Há itens aguardando pagamento nesta comanda.",
        tone: "border-brand-red/20 bg-brand-red/5 text-brand-red",
        Icon: CircleDollarSign,
      }
    : order.status === "AGUARDANDO_CONFIRMACAO"
      ? { eyebrow: "Próximo passo", title: "Confirmar pedido", description: "Envie o pedido para a fila de produção.", tone: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700", Icon: CheckCircle2 }
      : order.status === "AGUARDANDO_PAGAMENTO"
        ? { eyebrow: "Aguardando pagamento", title: "Pagamento em processamento", description: "O pedido segue para a produção após a confirmação do pagamento.", tone: "border-blue-500/25 bg-blue-500/10 text-blue-700", Icon: CircleDollarSign }
      : order.status === "NA_FILA"
        ? { eyebrow: "Em produção", title: "Acompanhar preparo", description: isDelivery ? "Quando estiver pronto, libere para despacho." : "Marque pronto ao finalizar — ou entregue direto no balcão.", tone: "border-brand-amber/35 bg-brand-amber/10 text-amber-800", Icon: Package }
        : order.status === "PRONTO" && isDelivery
          ? { eyebrow: "Pronto para sair", title: "Despachar entrega", description: "Confirme quem levará o pedido antes de colocá-lo em rota.", tone: "border-blue-500/25 bg-blue-500/10 text-blue-700", Icon: Bike }
          : order.status === "PRONTO"
            ? { eyebrow: "Aguardando retirada", title: "Confirmar entrega", description: "Finalize quando o cliente retirar o pedido.", tone: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700", Icon: CheckCircle2 }
            : order.status === "SAIU_PARA_ENTREGA"
              ? { eyebrow: "Entrega em rota", title: "Confirmar chegada", description: "Finalize assim que o pedido for entregue ao cliente.", tone: "border-blue-500/25 bg-blue-500/10 text-blue-700", Icon: Bike }
              : order.status === "ENTREGUE"
                ? { eyebrow: "Concluído", title: "Pedido entregue", description: "Consulte os itens, pagamento e histórico quando necessário.", tone: "border-emerald-500/20 bg-emerald-500/5 text-emerald-700", Icon: CheckCircle2 }
                : order.status === "CANCELADO"
                  ? { eyebrow: "Situação do pedido", title: "Pedido cancelado", description: "Nenhuma ação operacional está disponível.", tone: "border-red-500/20 bg-red-500/5 text-red-700", Icon: XCircle }
                  : { eyebrow: "Situação do pedido", title: "Aguardando atualização", description: "Confira os dados do pedido antes de seguir.", tone: "border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]", Icon: ReceiptText };

  const { Icon } = content;
  return (
    <section className={`rounded-2xl border p-3.5 ${content.tone}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 shadow-sm"><Icon size={19} /></span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-75">{content.eyebrow}</p>
          <h3 className="mt-0.5 text-base font-black text-[var(--text-primary)]">{content.title}</h3>
          <p className="mt-0.5 text-xs font-semibold text-[var(--text-secondary)]">{content.description}</p>
        </div>
      </div>
    </section>
  );
}

export function OrderDetailsSheet({ order, isOpen, onClose, onOrderUpdated, categoryLookup = {} }: Props) {
  const router = useRouter();
  const [showProgress, setShowProgress] = useState(false);
  const {
    isLoading, errorMsg, setErrorMsg,
    showCancelReason, setShowCancelReason, cancelReason, setCancelReason,
    showPaymentSelection, setShowPaymentSelection, showPayItems, setShowPayItems,
    showChangeMethod, setShowChangeMethod, editingItem, setEditingItem,
    showDispatchForm, setShowDispatchForm,
    courierNameInput, setCourierNameInput, courierPhoneInput, setCourierPhoneInput,
    courierIdInput, setCourierIdInput, registeredCouriers,
    onConfirm, onReady, onDeliver, onRevertToQueue, onConfirmDelivery, onCancel,
    onMarkPayment, onChangeMethod, onReprint, onDispatch, openDispatchForm,
  } = useOrderDetailsActions({ order, onClose, onOrderUpdated });

  if (!order) return null;

  // Timeline logic
  const isDelivery = order.type === "ENTREGA";
  const isNA_FILA = order.status === "NA_FILA";
  const isPRONTO  = order.status === "PRONTO";
  const isSAIU_PARA_ENTREGA = order.status === "SAIU_PARA_ENTREGA";
  const isENTREGUE = order.status === "ENTREGUE";
  const isCANCELADO = order.status === "CANCELADO";

  const hasDiscount = order.discount_amount > 0;
  const hasPacking  = order.packing_fee > 0;
  const hasDeliveryFee = Number(order.delivery_fee ?? 0) > 0;
  const subtotal = order.total_amount + order.discount_amount - order.packing_fee - Number(order.delivery_fee ?? 0);
  const isAppAwaitingPayment = order.source === "APP" && order.status === "AGUARDANDO_PAGAMENTO";
  const isPaid = order.payment_status === "PAID" || order.payment_status === "COURTESY";
  const outstandingAmount = getOutstandingOrderAmount(order);
  const hasOutstandingPayment = (order.payment_status === "PENDING" || order.payment_status === "PARTIAL") && outstandingAmount > 0;
  const canAddItems = !isAppAwaitingPayment && isOrderOpenForAdditions(order);
  const additionMinutesLeft = additionWindowRemainingMinutes(order);

  const queueEnteredAt = order.queue_entered_at ?? order.confirmed_at;
  const elapsedMin = isENTREGUE && order.delivered_at && queueEnteredAt
    ? Math.round((new Date(order.delivered_at).getTime() - new Date(queueEnteredAt).getTime()) / 60000)
    : null;
  const elapsedLabel = elapsedMin !== null
    ? elapsedMin < 60
      ? `${elapsedMin} min`
      : `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}min`
    : null;

  const queueAt = order.queue_entered_at ?? order.confirmed_at ?? order.created_at;
  const queueMinutes = minutesBetween(queueAt, order.ready_at ?? (isPRONTO ? new Date().toISOString() : null));
  const readyToDeliveredMinutes = minutesBetween(order.ready_at, order.delivered_at);
  const totalMinutes = minutesBetween(order.created_at, order.delivered_at ?? (isENTREGUE ? order.updated_at : null));
  // Métricas de tempo específicas de entrega (Fase 3): quanto tempo o pedido
  // ficou pronto esperando o entregador, e quanto tempo o entregador levou.
  const readyToDispatchedMinutes = minutesBetween(order.ready_at, order.dispatched_at);
  const dispatchedToDeliveredMinutes = minutesBetween(order.dispatched_at, order.delivery_delivered_at);
  const itemCount = (order.items ?? []).reduce((total, item) => total + Number(item.quantity ?? 0), 0);
  const typeLabel = order.type === "BALCAO" ? "Balcão" : isDelivery ? "Delivery" : "Para viagem";
  const sourceLabel = order.source === "ATTENDANT" ? "Atendente" : order.source === "QR_CODE" ? "QR Code" : order.source === "APP" ? "App" : order.source;
  const canShowFooterAction = !showPaymentSelection && !showCancelReason && !showChangeMethod && (
    (hasOutstandingPayment && !isAppAwaitingPayment) ||
    (!hasOutstandingPayment && ["AGUARDANDO_CONFIRMACAO", "NA_FILA", "SAIU_PARA_ENTREGA"].includes(order.status)) ||
    (!hasOutstandingPayment && order.status === "PRONTO" && (!isDelivery || !showDispatchForm))
  );

  return (
    <>
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Pedido #${String(order.daily_number).padStart(2, "0")}`}
      footer={canShowFooterAction ? (
        <div className="border-t border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 shadow-[0_-8px_18px_rgba(15,23,42,0.05)]">
          {!showPaymentSelection && !showCancelReason && !showChangeMethod && hasOutstandingPayment && !isAppAwaitingPayment && (
            <Button className="h-12 w-full rounded-2xl bg-brand-red text-sm font-black hover:bg-brand-red/90" onClick={() => setShowPayItems(true)} disabled={isLoading}>
              RECEBER {currency.format(outstandingAmount)}
            </Button>
          )}
          {!showPaymentSelection && !showCancelReason && !showChangeMethod && !hasOutstandingPayment && order.status === "AGUARDANDO_CONFIRMACAO" && (
            <Button className="h-12 w-full rounded-2xl bg-emerald-500 text-sm font-black hover:bg-emerald-600" onClick={onConfirm} disabled={isLoading}>
              CONFIRMAR PEDIDO
            </Button>
          )}
          {!showPaymentSelection && !showCancelReason && !showChangeMethod && !hasOutstandingPayment && order.status === "NA_FILA" && (
            <div className="flex gap-2">
              <Button className="h-12 flex-1 rounded-2xl bg-brand-amber text-sm font-black text-brand-charcoal hover:bg-brand-amber/90" onClick={onReady} disabled={isLoading}>
                MARCAR PRONTO
              </Button>
              {!isDelivery && <Button className="h-12 rounded-2xl bg-emerald-500 px-3 text-xs font-black hover:bg-emerald-600" onClick={onDeliver} disabled={isLoading}>ENTREGUE</Button>}
            </div>
          )}
          {!showPaymentSelection && !showCancelReason && !showChangeMethod && !hasOutstandingPayment && order.status === "PRONTO" && !isDelivery && (
            <Button className="h-12 w-full rounded-2xl bg-emerald-500 text-sm font-black hover:bg-emerald-600" onClick={onDeliver} disabled={isLoading}>ENTREGAR</Button>
          )}
          {!showPaymentSelection && !showCancelReason && !showChangeMethod && !hasOutstandingPayment && order.status === "PRONTO" && isDelivery && !showDispatchForm && (
            <Button className="h-12 w-full rounded-2xl bg-blue-500 text-sm font-black hover:bg-blue-600" onClick={openDispatchForm} disabled={isLoading}>DESPACHAR ENTREGA</Button>
          )}
          {!showPaymentSelection && !showCancelReason && !showChangeMethod && !hasOutstandingPayment && order.status === "SAIU_PARA_ENTREGA" && (
            <Button className="h-12 w-full rounded-2xl bg-emerald-500 text-sm font-black hover:bg-emerald-600" onClick={onConfirmDelivery} disabled={isLoading}>CONFIRMAR ENTREGA</Button>
          )}
        </div>
      ) : undefined}
    >
      <div className="flex flex-col gap-4 px-4 py-4 pb-8">

        {/* Error */}
        {errorMsg && (
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] p-4">
            <AlertTriangle className="shrink-0 text-[var(--status-danger)]" size={18} />
            <p className="text-sm font-bold text-[var(--status-danger)]">{errorMsg}</p>
          </div>
        )}

        {/* Identidade do pedido: informação primária, sem competir com a ação. */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-charcoal via-zinc-800 to-zinc-700 p-4 text-white shadow-lg shadow-zinc-950/15">
          <div className="absolute right-3 top-2 opacity-[0.08]">
            {order.type === "BALCAO" ? (
              <Utensils size={76} />
            ) : isDelivery ? (
              <Bike size={76} />
            ) : (
              <ShoppingBag size={76} />
            )}
          </div>
          <div className="relative space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{typeLabel} · {sourceLabel}</p>
                <h2 className="mt-1 truncate text-xl font-black leading-tight">
                  {order.customer_name || "Cliente Final"}
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-zinc-300"><Clock size={13} /> Criado às {fmt(order.created_at)} {elapsedLabel && <span className="ml-1 font-black text-emerald-300">· {elapsedLabel}</span>}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <OrderStatusBadge status={order.status} />
                <PaymentStatusBadge status={order.payment_status} />
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/[0.08] py-2.5">
              <div className="px-3"><p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Pedido</p><p className="mt-0.5 text-sm font-black">#{String(order.daily_number).padStart(2, "0")}</p></div>
              <div className="px-3"><p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Itens</p><p className="mt-0.5 text-sm font-black">{itemCount || order.items?.length || 0}</p></div>
              <div className="px-3"><p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Total</p><p className="mt-0.5 text-sm font-black tabular-nums">{currency.format(order.total_amount)}</p></div>
            </div>

            {!isCANCELADO && (
              <button type="button" onClick={() => setShowProgress((value) => !value)} aria-expanded={showProgress} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:text-white">
                <History size={12} /> {showProgress ? "Ocultar andamento" : "Ver andamento"}
                {showProgress ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}

            {/* Histórico fica disponível sem competir com a ação principal. */}
            {showProgress && !isCANCELADO && !isDelivery && (
              <div className="flex items-center gap-2 pt-1">
                <TimelineStep label="Criado"    time={fmt(order.created_at)}           done={true} />
                <TimelineConnector done={!!order.confirmed_at} />
                <TimelineStep label="Na Fila"   time={order.confirmed_at ? fmt(order.confirmed_at) : undefined} active={isNA_FILA}   done={!!order.ready_at || isPRONTO || isENTREGUE} />
                <TimelineConnector done={!!order.ready_at} />
                <TimelineStep label="Pronto"    time={order.ready_at ? fmt(order.ready_at) : undefined}         active={isPRONTO}    done={isENTREGUE} />
                <TimelineConnector done={isENTREGUE} />
                <TimelineStep label="Entregue"  time={order.delivered_at ? fmt(order.delivered_at) : undefined} active={isENTREGUE}  done={isENTREGUE} />
              </div>
            )}
            {showProgress && !isCANCELADO && isDelivery && (
              <div className="flex items-center gap-2 pt-1">
                <TimelineStep label="Criado"    time={fmt(order.created_at)}           done={true} />
                <TimelineConnector done={!!order.confirmed_at} />
                <TimelineStep label="Na Fila"   time={order.confirmed_at ? fmt(order.confirmed_at) : undefined} active={isNA_FILA}   done={!!order.ready_at || isPRONTO || isSAIU_PARA_ENTREGA || isENTREGUE} />
                <TimelineConnector done={!!order.ready_at} />
                <TimelineStep label="Pronto"    time={order.ready_at ? fmt(order.ready_at) : undefined}         active={isPRONTO}    done={isSAIU_PARA_ENTREGA || isENTREGUE} />
                <TimelineConnector done={!!order.dispatched_at} />
                <TimelineStep label="Saiu p/ Entrega" time={order.dispatched_at ? fmt(order.dispatched_at) : undefined} active={isSAIU_PARA_ENTREGA} done={isENTREGUE} />
                <TimelineConnector done={isENTREGUE} />
                <TimelineStep label="Entregue"  time={order.delivery_delivered_at ? fmt(order.delivery_delivered_at) : undefined} active={isENTREGUE}  done={isENTREGUE} />
              </div>
            )}
            {isCANCELADO && (
              <p className="text-xs font-bold text-red-300 uppercase tracking-widest">
                Cancelado às {order.cancelled_at ? fmt(order.cancelled_at) : "—"}
              </p>
            )}
          </div>
        </section>

        <OrderActionBrief order={order} isDelivery={isDelivery} hasOutstandingPayment={hasOutstandingPayment} outstandingAmount={outstandingAmount} />

        <OrderFulfillmentSummary order={order} />

        {order.notes && (
          <section className="flex gap-3 rounded-2xl border border-violet-500/15 bg-violet-500/[0.06] p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500 text-white"><MessageSquareText size={17} /></span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">Observação do pedido</p>
              <p className="mt-1 text-sm font-semibold leading-snug text-[var(--text-primary)]">{order.notes}</p>
            </div>
          </section>
        )}

        {showProgress && (isDelivery ? (
          <div className="grid grid-cols-4 gap-2">
            <TimeMetric label="Fila" value={formatDuration(queueMinutes)} />
            <TimeMetric label="Pronto > saiu" value={formatDuration(readyToDispatchedMinutes)} />
            <TimeMetric label="Saiu > entregue" value={formatDuration(dispatchedToDeliveredMinutes)} />
            <TimeMetric label="Total" value={formatDuration(totalMinutes)} />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <TimeMetric label="Fila" value={formatDuration(queueMinutes)} />
            <TimeMetric label="Pronto > entrega" value={formatDuration(readyToDeliveredMinutes)} />
            <TimeMetric label="Total" value={formatDuration(totalMinutes)} />
          </div>
        ))}

        {canAddItems && order.paid_at && (
          <button
            type="button"
            onClick={() => router.push(`/app/novo-pedido?add_to=${order.id}`)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--status-info)]/25 bg-[var(--status-info-bg)] px-4 py-3 text-left active:scale-[0.99]"
          >
            <span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--status-info)] text-white"><PlusCircle size={18} /></span><span><span className="block text-sm font-black text-[var(--text-primary)]">Adicionar à mesma comanda</span><span className="block text-xs font-semibold text-[var(--text-secondary)]">Os novos itens voltam para pagamento pendente.</span></span></span>
            <span className="shrink-0 text-[11px] font-black text-[var(--status-info)]">{additionMinutesLeft} min</span>
          </button>
        )}

        {/* Itens primeiro; ajustes e totais ficam contextualizados abaixo. */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"><ReceiptText size={13} /> Itens do pedido</p>
            <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-black text-[var(--text-secondary)]">{itemCount || order.items?.length || 0} {itemCount === 1 ? "item" : "itens"}</span>
          </div>
          <OrderItemsControl order={order} categoryLookup={categoryLookup} onMutated={onOrderUpdated} onEditItem={setEditingItem} />

          {/* Financial summary */}
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-subtle)]/80 px-4 py-2.5"><span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Resumo da cobrança</span><PaymentStatusBadge status={order.payment_status} /></div>
            <div className="p-4 space-y-2">
              {(hasDiscount || hasPacking || hasDeliveryFee) && (
                <div className="flex justify-between text-xs font-semibold text-[var(--text-muted)]">
                  <span>Subtotal</span>
                  <span>{currency.format(subtotal)}</span>
                </div>
              )}
              {hasPacking && (
                <div className="flex justify-between text-xs font-semibold text-[var(--text-muted)]">
                  <span>Embalagem</span>
                  <span>{currency.format(order.packing_fee)}</span>
                </div>
              )}
              {hasDeliveryFee && (
                <div className="flex justify-between text-xs font-semibold text-[var(--text-muted)]">
                  <span>Entrega</span>
                  <span>{currency.format(order.delivery_fee)}</span>
                </div>
              )}
              {hasDiscount && (
                <div className="flex justify-between text-xs font-bold text-emerald-600">
                  <span>Desconto</span>
                  <span>- {currency.format(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-[var(--border)] pt-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Total Geral</span>
                <span className={`text-2xl font-black ${order.payment_status === "PAID" ? "text-emerald-600" : "text-brand-red"}`}>
                  {currency.format(order.total_amount)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Gestão é secundária: a ação principal permanece fixa no rodapé. */}
        <section className="space-y-3 border-t border-[var(--border)] pt-5">
          <p className="px-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Ajustes e gestão</p>
          {!showPaymentSelection && !showCancelReason && !showChangeMethod && (
            <>
              {/* Primary status action */}
              {order.status === "AGUARDANDO_CONFIRMACAO" && (
                <Button
                  className="h-14 w-full rounded-2xl bg-emerald-500 text-lg font-black shadow-lg shadow-emerald-200 hover:bg-emerald-600 gap-2"
                  onClick={onConfirm}
                  disabled={isLoading}
                >
                  <CheckCircle2 size={20} /> CONFIRMAR PEDIDO
                </Button>
              )}
              {order.status === "NA_FILA" && (
                <div className="flex gap-2">
                  <Button
                    className="h-14 flex-1 rounded-2xl bg-brand-amber text-base font-black text-brand-charcoal shadow-lg shadow-brand-amber/20 hover:bg-brand-amber/90 gap-2"
                    onClick={onReady}
                    disabled={isLoading}
                  >
                    <Package size={20} /> MARCAR PRONTO
                  </Button>
                  {!isDelivery && (
                    <Button
                      className="h-14 rounded-2xl bg-emerald-500 px-3 text-xs font-black shadow-lg shadow-emerald-200 hover:bg-emerald-600 gap-1.5"
                      onClick={onDeliver}
                      disabled={isLoading}
                    >
                      <CheckCircle2 size={17} /> ENTREGUE AGORA
                    </Button>
                  )}
                </div>
              )}
              {order.status === "PRONTO" && !isDelivery && (
                <div className="flex gap-2">
                  <Button
                    className="h-14 flex-1 rounded-2xl bg-emerald-500 text-lg font-black shadow-lg shadow-emerald-200 hover:bg-emerald-600 gap-2"
                    onClick={onDeliver}
                    disabled={isLoading}
                  >
                    <CheckCircle2 size={20} /> ENTREGAR
                  </Button>
                  <Button
                    variant="outline"
                    className="h-14 rounded-2xl border-2 border-[var(--border-strong)] text-xs font-black text-[var(--text-muted)] hover:bg-[var(--border)] gap-1 px-3"
                    onClick={onRevertToQueue}
                    disabled={isLoading}
                    title="Voltar para Na Fila"
                  >
                    <ArrowLeft size={16} /> NA FILA
                  </Button>
                </div>
              )}
              {order.status === "PRONTO" && isDelivery && !showDispatchForm && (
                <div className="flex gap-2">
                  <Button
                    className="h-14 flex-1 rounded-2xl bg-blue-500 text-lg font-black shadow-lg shadow-blue-200 hover:bg-blue-600 gap-2"
                    onClick={openDispatchForm}
                    disabled={isLoading}
                  >
                    <Bike size={20} /> DESPACHAR
                  </Button>
                  <Button
                    variant="outline"
                    className="h-14 rounded-2xl border-2 border-[var(--border-strong)] text-xs font-black text-[var(--text-muted)] hover:bg-[var(--border)] gap-1 px-3"
                    onClick={onRevertToQueue}
                    disabled={isLoading}
                    title="Voltar para Na Fila"
                  >
                    <ArrowLeft size={16} /> NA FILA
                  </Button>
                </div>
              )}
              {order.status === "PRONTO" && isDelivery && showDispatchForm && (
                <div className="space-y-3 rounded-2xl border-2 border-blue-500/20 bg-blue-500/10 p-4 animate-in fade-in zoom-in-95">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Bike size={18} />
                    <h4 className="text-sm font-black uppercase tracking-widest">Despachar Entrega</h4>
                  </div>
                  {registeredCouriers.length > 0 && (
                    <select
                      className="w-full rounded-xl border border-[var(--status-info)]/30 bg-[var(--bg-surface)] p-3 text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-300"
                      value={courierIdInput}
                      onChange={(e) => setCourierIdInput(e.target.value)}
                    >
                      <option value="">Digitar entregador avulso...</option>
                      {registeredCouriers.filter((c) => c.active).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>
                      ))}
                    </select>
                  )}
                  {!courierIdInput && (
                    <>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-[var(--status-info)]/30 bg-[var(--bg-surface)] p-3 text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-300"
                        placeholder="Nome do entregador"
                        value={courierNameInput}
                        onChange={(e) => setCourierNameInput(e.target.value)}
                      />
                      <input
                        type="text"
                        className="w-full rounded-xl border border-[var(--status-info)]/30 bg-[var(--bg-surface)] p-3 text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-300"
                        placeholder="Telefone do entregador (opcional)"
                        value={courierPhoneInput}
                        onChange={(e) => setCourierPhoneInput(e.target.value)}
                      />
                    </>
                  )}
                  <div className="flex gap-3">
                    <Button
                      className="flex-1 h-12 rounded-xl bg-blue-500 font-black shadow-lg shadow-blue-200 hover:bg-blue-600"
                      onClick={onDispatch}
                      disabled={isLoading}
                    >
                      CONFIRMAR DESPACHO
                    </Button>
                    <Button
                      variant="outline"
                      className="h-12 rounded-xl border-2 font-black"
                      onClick={() => setShowDispatchForm(false)}
                      disabled={isLoading}
                    >
                      VOLTAR
                    </Button>
                  </div>
                </div>
              )}
              {order.status === "SAIU_PARA_ENTREGA" && (
                <Button
                  className="h-14 w-full rounded-2xl bg-emerald-500 text-lg font-black shadow-lg shadow-emerald-200 hover:bg-emerald-600 gap-2"
                  onClick={onConfirmDelivery}
                  disabled={isLoading}
                >
                  <CheckCircle2 size={20} /> CONFIRMAR ENTREGA
                </Button>
              )}

              {/* Payment pending / partial alert */}

              {/* Add to order */}
              {canAddItems && (
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-2xl border-2 border-[var(--border-strong)] font-black gap-2"
                  onClick={() => router.push(`/app/novo-pedido?add_to=${order.id}`)}
                  disabled={isLoading}
                >
                  <PlusCircle size={18} /> {order.paid_at ? "ADICIONAR À MESMA COMANDA" : "ADICIONAR À COMANDA"}
                </Button>
              )}

              {/* Alterar pagamento */}
              {isPaid && !isCANCELADO && (
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-2xl border-2 font-black text-xs text-[var(--text-secondary)] gap-2"
                  onClick={() => setShowChangeMethod(true)}
                  disabled={isLoading}
                >
                  <ArrowLeft size={14} className="rotate-180" /> ALTERAR PAGAMENTO
                </Button>
              )}

              {/* Secondary actions */}
              <div className="grid grid-cols-2 gap-3">
                {["NA_FILA", "PRONTO", "SAIU_PARA_ENTREGA", "ENTREGUE"].includes(order.status) && (
                  <Button
                    variant="outline"
                    className="h-12 rounded-2xl border-2 font-black text-xs text-[var(--text-secondary)] gap-2"
                    onClick={onReprint}
                    disabled={isLoading}
                  >
                    <Printer size={14} /> REIMPRIMIR
                  </Button>
                )}
                {["AGUARDANDO_CONFIRMACAO", "AGUARDANDO_PAGAMENTO", "NA_FILA", "PRONTO"].includes(order.status) && (
                  <Button
                    variant="outline"
                    className="h-12 rounded-2xl border-2 border-[var(--status-danger)]/20 font-black text-xs text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)] gap-2"
                    onClick={() => setShowCancelReason(true)}
                    disabled={isLoading}
                  >
                    <XCircle size={14} /> CANCELAR
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Change payment method */}
          {showChangeMethod && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowChangeMethod(false)} className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-[var(--border)]">
                  <ArrowLeft size={18} />
                </button>
                <h4 className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)]">Alterar Pagamento</h4>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(["PIX", "CASH", "DEBIT_CARD", "CREDIT_CARD", "IFOOD"] as PaymentMethod[]).map((method) => {
                  const { label, Icon, color } = PAYMENT_METHOD_CONFIG[method];
                  const isCurrent = order.payment_method === method;
                  return (
                    <button
                      key={method}
                      onClick={() => onChangeMethod(method)}
                      disabled={isLoading || isCurrent}
                      className={`flex flex-col items-center justify-center gap-2 h-16 rounded-2xl border-2 font-black text-xs transition-all active:scale-95 ${color} ${isCurrent ? "ring-2 ring-current ring-offset-1 opacity-70" : ""}`}
                    >
                      <Icon size={16} /> {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment selection */}
          {showPaymentSelection && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPaymentSelection(false)} className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-[var(--border)]">
                  <ArrowLeft size={18} />
                </button>
                <h4 className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)]">Forma de Pagamento</h4>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(["PIX", "CASH", "DEBIT_CARD", "CREDIT_CARD", "IFOOD", "COURTESY"] as PaymentMethod[]).map((method) => {
                  const { label, Icon, color } = PAYMENT_METHOD_CONFIG[method];
                  return (
                    <button
                      key={method}
                      onClick={() => onMarkPayment(method, method === "COURTESY" ? "COURTESY" : "PAID")}
                      disabled={isLoading}
                      className={`flex flex-col items-center justify-center gap-2 h-16 rounded-2xl border-2 font-black text-xs transition-all active:scale-95 ${color}`}
                    >
                      <Icon size={16} /> {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cancel reason */}
          {showCancelReason && (
            <div className="space-y-4 rounded-2xl border-2 border-[var(--status-danger)]/20 bg-[var(--status-danger-bg)] p-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2 text-red-600">
                <XCircle size={18} />
                <h4 className="text-sm font-black uppercase tracking-widest">Cancelar Pedido</h4>
              </div>
              <input
                type="text"
                className="w-full rounded-xl border border-[var(--status-danger)]/30 bg-[var(--bg-surface)] p-4 font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-red-300"
                placeholder="Qual o motivo?"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  className="flex-1 h-12 rounded-xl font-black shadow-lg shadow-red-200"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  CONFIRMAR
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-xl border-2 font-black"
                  onClick={() => { setShowCancelReason(false); setErrorMsg(""); }}
                  disabled={isLoading}
                >
                  VOLTAR
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </BottomSheet>
    {showPayItems && (
      <PayItemsModal
        order={order}
        onClose={() => setShowPayItems(false)}
        onPaymentRegistered={onOrderUpdated}
        onPaid={() => { setShowPayItems(false); onOrderUpdated(); }}
      />
    )}
    {editingItem && (
      <EditOrderItemSheet
        item={editingItem}
        isOpen={true}
        onClose={() => setEditingItem(null)}
        onSaved={() => { setEditingItem(null); onOrderUpdated(); }}
      />
    )}
    </>
  );
}
