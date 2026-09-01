"use client";

import { useEffect, useState } from "react";
import { Order } from "@/types/pdv";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { OrderItemsControl } from "./OrderItemsControl";
import { PayItemsModal } from "./PayItemsModal";
import { EditOrderItemSheet } from "./EditOrderItemSheet";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { useRouter } from "next/navigation";
import {
  formatDuration,
  formatOrderTime as fmt,
  minutesBetween,
  ORDER_DETAILS_PAYMENT_LABELS as PAYMENT_LABEL,
  ORDER_DETAILS_PAYMENT_METHODS as PAYMENT_METHODS,
  orderCurrency as currency,
  useOrderDetailsActions,
} from "./order-details-shared";
import {
  X, PlusCircle, Printer, CheckCircle2, Package, XCircle,
  AlertTriangle, ArrowLeft, Utensils, ShoppingBag,
  ChevronDown, ChevronUp,
  History, Bike, MapPin,
} from "lucide-react";

function TimelineStep({
  label, time, active, done,
}: { label: string; time?: string; active?: boolean; done?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1 transition-opacity ${done || active ? "opacity-100" : "opacity-30"}`}>
      <div className={`h-2.5 w-2.5 rounded-full border-2 transition-all ${
        done
          ? "border-emerald-400 bg-emerald-400"
          : active
          ? "border-white bg-white ring-4 ring-white/20"
          : "border-white/40 bg-transparent"
      }`} />
      <p className="text-[9px] font-black uppercase tracking-wide text-white/60 text-center leading-tight whitespace-nowrap">
        {label}
      </p>
      {time && <p className="text-[9px] font-bold text-white/40">{time}</p>}
    </div>
  );
}

function TimelineConnector({ done }: { done: boolean }) {
  return (
    <div className={`flex-1 h-0.5 rounded-full transition-colors ${done ? "bg-emerald-400" : "bg-white/15"}`} />
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

interface Props {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: () => void | Promise<void>;
}

export function OrderDetailsModal({ order, isOpen, onClose, onOrderUpdated }: Props) {
  const router = useRouter();
  const [showHistory, setShowHistory] = useState(false);
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
    resetActionPanels,
  } = useOrderDetailsActions({ order, onClose, onOrderUpdated });

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Reset panels when order changes
  useEffect(() => {
    const timer = window.setTimeout(() => {
      resetActionPanels();
      setShowHistory(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [order?.id, resetActionPanels]);

  if (!isOpen || !order) return null;

  const isDelivery   = order.type === "ENTREGA";
  const isCANCELADO  = order.status === "CANCELADO";
  const isNA_FILA    = order.status === "NA_FILA";
  const isPRONTO     = order.status === "PRONTO";
  const isSAIU_PARA_ENTREGA = order.status === "SAIU_PARA_ENTREGA";
  const isENTREGUE   = order.status === "ENTREGUE";
  const hasDiscount  = order.discount_amount > 0;
  const hasPacking   = order.packing_fee > 0;
  const hasDeliveryFee = Number(order.delivery_fee ?? 0) > 0;
  const subtotal     = order.total_amount + order.discount_amount - order.packing_fee - Number(order.delivery_fee ?? 0);
  const isAppAwaitingPayment = order.source === "APP" && order.status === "AGUARDANDO_PAGAMENTO";
  const isPaid       = order.payment_status === "PAID" || order.payment_status === "COURTESY";
  const canAddItems = !isCANCELADO && !["EXPIRADO", "AGUARDANDO_CONFIRMACAO", "SAIU_PARA_ENTREGA"].includes(order.status) && !isAppAwaitingPayment;

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
  const readyToDispatchedMinutes = minutesBetween(order.ready_at, order.dispatched_at);
  const dispatchedToDeliveredMinutes = minutesBetween(order.dispatched_at, order.delivery_delivered_at);

  const historyEvents = [
    { label: "Criado",     time: order.created_at },
    { label: "Confirmado", time: order.confirmed_at },
    { label: "Na Fila",    time: order.queue_entered_at ?? order.confirmed_at },
    { label: "Pronto",     time: order.ready_at },
    { label: "Saiu p/ Entrega", time: order.dispatched_at },
    { label: "Entregue",   time: isDelivery ? order.delivery_delivered_at : order.delivered_at },
    { label: "Cancelado",  time: order.cancelled_at },
  ].filter((e, i, arr) => e.time && (i === 0 || e.time !== arr[i - 1]?.time));

  return (
    <>
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        maxWidth="3xl"
        bodyClassName="contents"
        footer={
          <Button
            variant="outline"
            className="h-11 w-full rounded-2xl border-2 text-sm font-black"
            onClick={onClose}
          >
            FECHAR
          </Button>
        }
        header={
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-charcoal to-zinc-800 px-5 py-4 text-white shrink-0">
          <div className="absolute right-16 top-0 bottom-0 flex items-center opacity-[0.06]">
            {order.type === "BALCAO" ? <Utensils size={96} /> : isDelivery ? <Bike size={96} /> : <ShoppingBag size={96} />}
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-4 top-4 rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>

          <div className="relative pr-10 space-y-3">
            {/* Number + name row */}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 border border-white/15">
                <span className="text-xl font-black leading-none">
                  {String(order.daily_number).padStart(2, "0")}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-black leading-tight truncate">
                  {order.customer_name || <span className="italic text-white/40 font-bold">Cliente final</span>}
                </h2>
                <p className="text-[11px] text-white/40 mt-0.5">
                  {order.type === "BALCAO" ? "Balcão" : isDelivery ? "Entrega" : "Para Viagem"} ·{" "}
                  {order.source === "ATTENDANT" ? "Atendente" : order.source === "QR_CODE" ? "QR Code" : order.source === "APP" ? "App" : "WhatsApp"} ·{" "}
                  Criado às {fmt(order.created_at)}
                  {elapsedLabel && (
                    <span className="ml-1 font-black text-emerald-400"> · {elapsedLabel}</span>
                  )}
                </p>
              </div>

            </div>

            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              {order.type === "VIAGEM" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-200 ring-1 ring-amber-300/30">
                  <ShoppingBag className="h-2.5 w-2.5" strokeWidth={2.25} />
                  Viagem
                </span>
              )}
              {isDelivery && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-200 ring-1 ring-blue-300/30">
                  <Bike className="h-2.5 w-2.5" strokeWidth={2.25} />
                  Entrega
                </span>
              )}
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.payment_status} />
              {order.payment_method && order.payment_status !== "PENDING" && (
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">
                  · {PAYMENT_LABEL[order.payment_method] ?? order.payment_method}
                </span>
              )}
            </div>

            {/* Endereço de entrega */}
            {isDelivery && (order.delivery_street || order.delivery_neighborhood) && (
              <div className="flex items-start gap-2 rounded-xl bg-white/10 px-3 py-2">
                <MapPin size={13} className="mt-0.5 shrink-0 text-blue-300" />
                <p className="text-[11px] font-bold text-zinc-100 leading-snug">
                  {[order.delivery_street, order.delivery_number].filter(Boolean).join(", ")}
                  {order.delivery_complement ? ` - ${order.delivery_complement}` : ""}
                  {order.delivery_neighborhood ? ` · ${order.delivery_neighborhood}` : ""}
                  {order.delivery_reference ? ` (${order.delivery_reference})` : ""}
                  {(order.courier_name || order.courier_phone) && (
                    <span className="mt-1 block text-blue-200">
                      Entregador: {order.courier_name || "—"}{order.courier_phone ? ` · ${order.courier_phone}` : ""}
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Timeline */}
            {!isCANCELADO && !isDelivery ? (
              <div className="flex items-center gap-1.5 pt-0.5">
                <TimelineStep label="Criado"   time={fmt(order.created_at)} done />
                <TimelineConnector done={!!order.confirmed_at} />
                <TimelineStep label="Na Fila"  time={order.confirmed_at ? fmt(order.confirmed_at) : undefined} active={isNA_FILA} done={!!order.ready_at || isPRONTO || isENTREGUE} />
                <TimelineConnector done={!!order.ready_at} />
                <TimelineStep label="Pronto"   time={order.ready_at ? fmt(order.ready_at) : undefined} active={isPRONTO} done={isENTREGUE} />
                <TimelineConnector done={isENTREGUE} />
                <TimelineStep label="Entregue" time={order.delivered_at ? fmt(order.delivered_at) : undefined} active={isENTREGUE} done={isENTREGUE} />
              </div>
            ) : !isCANCELADO && isDelivery ? (
              <div className="flex items-center gap-1.5 pt-0.5">
                <TimelineStep label="Criado"   time={fmt(order.created_at)} done />
                <TimelineConnector done={!!order.confirmed_at} />
                <TimelineStep label="Na Fila"  time={order.confirmed_at ? fmt(order.confirmed_at) : undefined} active={isNA_FILA} done={!!order.ready_at || isPRONTO || isSAIU_PARA_ENTREGA || isENTREGUE} />
                <TimelineConnector done={!!order.ready_at} />
                <TimelineStep label="Pronto"   time={order.ready_at ? fmt(order.ready_at) : undefined} active={isPRONTO} done={isSAIU_PARA_ENTREGA || isENTREGUE} />
                <TimelineConnector done={!!order.dispatched_at} />
                <TimelineStep label="Saiu p/ Entrega" time={order.dispatched_at ? fmt(order.dispatched_at) : undefined} active={isSAIU_PARA_ENTREGA} done={isENTREGUE} />
                <TimelineConnector done={isENTREGUE} />
                <TimelineStep label="Entregue" time={order.delivery_delivered_at ? fmt(order.delivery_delivered_at) : undefined} active={isENTREGUE} done={isENTREGUE} />
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/15 px-3 py-2">
                <XCircle size={13} className="text-red-300 shrink-0" />
                <span className="text-xs font-black text-red-300 uppercase tracking-widest">
                  Cancelado{order.cancelled_at ? ` às ${fmt(order.cancelled_at)}` : ""}
                </span>
              </div>
            )}
          </div>
        </div>
        }
      >

        {/* ── Body: 2 panels on lg, 1 col on md ──────────────── */}
        <div className="flex flex-1 overflow-hidden min-h-0 flex-col lg:flex-row">

          {/* LEFT — items + financial + history */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 lg:border-r border-[var(--border)]">

            {/* Items + controles por item */}
            <div className="space-y-3">
              <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                Itens do Pedido
              </p>
              <OrderItemsControl order={order} onMutated={onOrderUpdated} onEditItem={setEditingItem} />

              {/* Financial summary */}
              <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
                <div className="bg-[var(--bg-subtle)]/80 px-4 py-3 space-y-1.5">
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
                      <span>
                        Desconto{order.discount_reason ? ` (${order.discount_reason})` : ""}
                      </span>
                      <span>− {currency.format(order.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-[var(--border)] pt-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                      Total Geral
                    </span>
                    <span className={`text-2xl font-black ${
                      order.payment_status === "PAID"     ? "text-emerald-600"
                      : order.payment_status === "COURTESY" ? "text-[var(--text-secondary)]"
                      : "text-brand-red"
                    }`}>
                      {currency.format(order.total_amount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {isDelivery ? (
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
            )}

            {/* Notes */}
            {order.notes && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3">
                <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                  Observações
                </p>
                <p className="text-sm italic text-[var(--text-muted)]">&ldquo;{order.notes}&rdquo;</p>
              </div>
            )}

            {/* History (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="flex w-full items-center justify-between px-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2"
              >
                <span className="flex items-center gap-1.5">
                  <History size={11} /> Histórico de Status
                </span>
                {showHistory ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
              {showHistory && (
                <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] divide-y divide-[var(--border)] animate-in fade-in slide-in-from-top-2 duration-150">
                  {historyEvents.map((e) => (
                    <div key={e.label} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs font-bold text-[var(--text-muted)]">{e.label}</span>
                      <span className="text-xs font-black text-[var(--text-secondary)]">{fmt(e.time!)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — actions */}
          <div className="shrink-0 overflow-y-auto bg-[var(--bg-subtle)]/80 p-5 space-y-3 lg:w-72 lg:border-t-0 border-t border-[var(--border)]">

            {/* Error */}
            {errorMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] p-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-[var(--status-danger)]" size={14} />
                <p className="text-xs font-bold text-[var(--status-danger)]">{errorMsg}</p>
              </div>
            )}

            {/* ─ Default actions ─ */}
            {!showPaymentSelection && !showCancelReason && !showChangeMethod && (
              <>
                {/* Primary status CTA */}
                {order.status === "AGUARDANDO_CONFIRMACAO" && (
                  <Button
                    className="h-14 w-full rounded-2xl bg-emerald-500 text-base font-black shadow-lg shadow-emerald-200 hover:bg-emerald-600 gap-2"
                    onClick={onConfirm}
                    disabled={isLoading}
                  >
                    <CheckCircle2 size={18} /> CONFIRMAR PEDIDO
                  </Button>
                )}
                {order.status === "NA_FILA" && (
                  <Button
                    className="h-14 w-full rounded-2xl bg-brand-amber text-base font-black text-brand-charcoal shadow-lg shadow-brand-amber/20 hover:bg-brand-amber/90 gap-2"
                    onClick={onReady}
                    disabled={isLoading}
                  >
                    <Package size={18} /> MARCAR PRONTO
                  </Button>
                )}
                {order.status === "PRONTO" && !isDelivery && (
                  <div className="flex gap-2">
                    <Button
                      className="h-14 flex-1 rounded-2xl bg-emerald-500 text-base font-black shadow-lg shadow-emerald-200 hover:bg-emerald-600 gap-2"
                      onClick={onDeliver}
                      disabled={isLoading}
                    >
                      <CheckCircle2 size={18} /> ENTREGAR
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14 rounded-2xl border-2 border-[var(--border-strong)] text-xs font-black text-[var(--text-muted)] hover:bg-[var(--border)] gap-1 px-3"
                      onClick={onRevertToQueue}
                      disabled={isLoading}
                      title="Voltar para Na Fila"
                    >
                      <ArrowLeft size={14} /> NA FILA
                    </Button>
                  </div>
                )}
                {order.status === "PRONTO" && isDelivery && !showDispatchForm && (
                  <div className="flex gap-2">
                    <Button
                      className="h-14 flex-1 rounded-2xl bg-blue-500 text-base font-black shadow-lg shadow-blue-200 hover:bg-blue-600 gap-2"
                      onClick={openDispatchForm}
                      disabled={isLoading}
                    >
                      <Bike size={18} /> DESPACHAR
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14 rounded-2xl border-2 border-[var(--border-strong)] text-xs font-black text-[var(--text-muted)] hover:bg-[var(--border)] gap-1 px-3"
                      onClick={onRevertToQueue}
                      disabled={isLoading}
                      title="Voltar para Na Fila"
                    >
                      <ArrowLeft size={14} /> NA FILA
                    </Button>
                  </div>
                )}
                {order.status === "PRONTO" && isDelivery && showDispatchForm && (
                  <div className="space-y-3 rounded-2xl border-2 border-blue-500/20 bg-blue-500/10 p-4 animate-in fade-in zoom-in-95">
                    <div className="flex items-center gap-2 text-blue-600">
                      <Bike size={16} />
                      <h4 className="text-xs font-black uppercase tracking-widest">Despachar Entrega</h4>
                    </div>
                    {registeredCouriers.length > 0 && (
                      <select
                        className="w-full rounded-xl border border-[var(--status-info)]/30 bg-[var(--bg-surface)] p-2.5 text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                          className="w-full rounded-xl border border-[var(--status-info)]/30 bg-[var(--bg-surface)] p-2.5 text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder="Nome do entregador"
                          value={courierNameInput}
                          onChange={(e) => setCourierNameInput(e.target.value)}
                        />
                        <input
                          type="text"
                          className="w-full rounded-xl border border-[var(--status-info)]/30 bg-[var(--bg-surface)] p-2.5 text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder="Telefone do entregador (opcional)"
                          value={courierPhoneInput}
                          onChange={(e) => setCourierPhoneInput(e.target.value)}
                        />
                      </>
                    )}
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 h-11 rounded-xl bg-blue-500 text-sm font-black shadow-lg shadow-blue-200 hover:bg-blue-600"
                        onClick={onDispatch}
                        disabled={isLoading}
                      >
                        CONFIRMAR DESPACHO
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 rounded-xl border-2 text-sm font-black"
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
                    className="h-14 w-full rounded-2xl bg-emerald-500 text-base font-black shadow-lg shadow-emerald-200 hover:bg-emerald-600 gap-2"
                    onClick={onConfirmDelivery}
                    disabled={isLoading}
                  >
                    <CheckCircle2 size={18} /> CONFIRMAR ENTREGA
                  </Button>
                )}

                {/* Payment pending / partial alert */}
                {(order.payment_status === "PENDING" || order.payment_status === "PARTIAL") && !isCANCELADO && !isAppAwaitingPayment && (
                  <div className="rounded-2xl border-2 border-brand-amber/30 bg-brand-amber/5 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-brand-amber">
                      <AlertTriangle size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {order.payment_status === "PARTIAL" ? "Pagamento Parcial" : "Pagamento Pendente"}
                      </span>
                    </div>
                    <Button
                      className="h-11 w-full bg-brand-amber text-sm font-black text-brand-charcoal hover:bg-brand-amber/80"
                      onClick={() => setShowPayItems(true)}
                      disabled={isLoading}
                    >
                      PAGAR ITENS PENDENTES
                    </Button>
                  </div>
                )}

                {/* Add to order */}
                {canAddItems && (
                  <Button
                    variant="outline"
                    className="h-11 w-full rounded-2xl border-2 border-[var(--border-strong)] text-sm font-black gap-2"
                    onClick={() => router.push(`/app/novo-pedido?add_to=${order.id}`)}
                    disabled={isLoading}
                  >
                    <PlusCircle size={15} /> ADICIONAR À COMANDA
                  </Button>
                )}

                <hr className="border-[var(--border)]" />

                {/* Alterar forma de pagamento */}
                {isPaid && !isCANCELADO && (
                  <Button
                    variant="outline"
                    className="h-11 w-full rounded-2xl border-2 text-xs font-black text-[var(--text-secondary)] gap-2"
                    onClick={() => setShowChangeMethod(true)}
                    disabled={isLoading}
                  >
                    <ArrowLeft size={14} className="rotate-180" /> ALTERAR PAGAMENTO
                  </Button>
                )}

                {/* Secondary actions */}
                {["NA_FILA", "PRONTO", "SAIU_PARA_ENTREGA", "ENTREGUE"].includes(order.status) && (
                  <Button
                    variant="outline"
                    className="h-11 w-full rounded-2xl border-2 text-xs font-black text-[var(--text-secondary)] gap-2"
                    onClick={onReprint}
                    disabled={isLoading}
                  >
                    <Printer size={14} /> REIMPRIMIR
                  </Button>
                )}
                {["AGUARDANDO_CONFIRMACAO", "AGUARDANDO_PAGAMENTO", "NA_FILA", "PRONTO"].includes(order.status) && (
                  <Button
                    variant="outline"
                    className="h-11 w-full rounded-2xl border-2 border-[var(--status-danger)]/20 text-xs font-black text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)] gap-2"
                    onClick={() => setShowCancelReason(true)}
                    disabled={isLoading}
                  >
                    <XCircle size={14} /> CANCELAR PEDIDO
                  </Button>
                )}

                {["ENTREGUE", "CANCELADO", "EXPIRADO"].includes(order.status) &&
                  !(isENTREGUE && (order.payment_status === "PENDING" || order.payment_status === "PARTIAL")) && (
                  <p className="py-4 text-center text-xs font-bold text-[var(--text-muted)]">
                    Pedido finalizado
                  </p>
                )}
              </>
            )}

            {/* ─ Change payment method ─ */}
            {showChangeMethod && (
              <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-150">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowChangeMethod(false)}
                    className="rounded-xl p-1.5 text-[var(--text-muted)] hover:bg-[var(--border)] transition-colors"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    Alterar Forma de Pagamento
                  </h4>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.filter((method) => method.value !== "COURTESY" && method.value !== "PENDING").map(({ value, label, Icon, color }) => (
                    <button
                      key={value}
                      onClick={() => onChangeMethod(value)}
                      disabled={isLoading}
                      className={`flex flex-col items-center justify-center gap-2 h-16 rounded-2xl border-2 text-xs font-black transition-all active:scale-95 disabled:opacity-50 ${color} ${order.payment_method === value ? "ring-2 ring-offset-1 ring-current opacity-70" : ""}`}
                    >
                      <Icon size={18} /> {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─ Payment selection ─ */}
            {showPaymentSelection && (
              <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-150">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPaymentSelection(false)}
                    className="rounded-xl p-1.5 text-[var(--text-muted)] hover:bg-[var(--border)] transition-colors"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    Forma de Pagamento
                  </h4>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map(({ value, label, Icon, color }) => (
                    <button
                      key={value}
                      onClick={() => onMarkPayment(value, value === "COURTESY" ? "COURTESY" : "PAID")}
                      disabled={isLoading}
                      className={`flex flex-col items-center justify-center gap-2 h-16 rounded-2xl border-2 text-xs font-black transition-all active:scale-95 disabled:opacity-50 ${color}`}
                    >
                      <Icon size={18} /> {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─ Cancel reason ─ */}
            {showCancelReason && (
              <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-150">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setShowCancelReason(false); setErrorMsg(""); }}
                    className="rounded-xl p-1.5 text-[var(--text-muted)] hover:bg-[var(--border)] transition-colors"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <h4 className="text-xs font-black uppercase tracking-widest text-red-600">
                    Cancelar Pedido
                  </h4>
                </div>
                <textarea
                  className="h-24 w-full resize-none rounded-xl border border-[var(--status-danger)]/30 bg-[var(--bg-surface)] p-3 text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-red-300"
                  placeholder="Descreva o motivo do cancelamento..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
                <Button
                  variant="destructive"
                  className="h-12 w-full rounded-xl font-black shadow-lg shadow-red-200"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  CONFIRMAR CANCELAMENTO
                </Button>
              </div>
            )}
          </div>
        </div>
      </Sheet>
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
