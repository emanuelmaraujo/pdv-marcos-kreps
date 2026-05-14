"use client";

import { useEffect, useState } from "react";
import { Order, PaymentMethod, PaymentStatus } from "@/types/pdv";
import { Button } from "@/components/ui/Button";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { pdvApi } from "@/lib/api/pdv-api";
import { useRouter } from "next/navigation";
import {
  X, PlusCircle, Printer, CheckCircle2, Package, XCircle,
  AlertTriangle, ArrowLeft, Utensils, ShoppingBag,
  QrCode, Banknote, CreditCard, Gift, ChevronDown, ChevronUp,
  History,
} from "lucide-react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

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

const PAYMENT_METHODS: { value: PaymentMethod; label: string; Icon: React.ElementType; color: string }[] = [
  { value: "PIX",         label: "PIX",      Icon: QrCode,    color: "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100" },
  { value: "CASH",        label: "Dinheiro", Icon: Banknote,  color: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
  { value: "DEBIT_CARD",  label: "Débito",   Icon: CreditCard, color: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" },
  { value: "CREDIT_CARD", label: "Crédito",  Icon: CreditCard, color: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100" },
];

const PAYMENT_LABEL: Record<string, string> = {
  PIX: "PIX", CASH: "Dinheiro", DEBIT_CARD: "Débito",
  CREDIT_CARD: "Crédito", COURTESY: "Cortesia", PENDING: "Pendente",
};

interface Props {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: () => void;
}

export function OrderDetailsModal({ order, isOpen, onClose, onOrderUpdated }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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
      setErrorMsg("");
      setShowCancelReason(false);
      setCancelReason("");
      setShowPaymentSelection(false);
      setShowHistory(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [order?.id]);

  if (!isOpen || !order) return null;

  const handleAction = async (action: () => Promise<unknown>) => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      await action();
      onOrderUpdated();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Ocorreu um erro na ação.");
    } finally {
      setIsLoading(false);
    }
  };

  const onConfirm = () => handleAction(() => pdvApi.confirmOrder(order.id));
  const onReady   = () => handleAction(() => pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "PRONTO" }));
  const onDeliver = () => {
    if (order.payment_status === "PENDING") {
      if (!window.confirm("ATENÇÃO: Pagamento PENDENTE. Confirmar entrega mesmo assim?")) return;
    }
    handleAction(() => pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "ENTREGUE" }));
  };
  const onCancel = () => {
    if (!cancelReason.trim()) { setErrorMsg("Motivo obrigatório."); return; }
    handleAction(() => pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "CANCELADO", reason: cancelReason }));
  };
  const onMarkPayment = (method: PaymentMethod, pStatus: PaymentStatus) =>
    handleAction(() => pdvApi.markPayment({ orderId: order.id, paymentMethod: method, status: pStatus, amount: order.total_amount }));
  const onReprint = () =>
    handleAction(() => pdvApi.reprintOrder({
      orderId: order.id,
      copies: order.source === "APP" ? ["KITCHEN", "JUICE_POTATO"] : ["CUSTOMER", "KITCHEN", "JUICE_POTATO"],
    }));

  const isCANCELADO  = order.status === "CANCELADO";
  const isNA_FILA    = order.status === "NA_FILA";
  const isPRONTO     = order.status === "PRONTO";
  const isENTREGUE   = order.status === "ENTREGUE";
  const hasDiscount  = order.discount_amount > 0;
  const hasPacking   = order.packing_fee > 0;
  const subtotal     = order.total_amount + order.discount_amount - order.packing_fee;
  const isAppAwaitingPayment = order.source === "APP" && order.status === "AGUARDANDO_PAGAMENTO";

  const historyEvents = [
    { label: "Criado",     time: order.created_at },
    { label: "Confirmado", time: order.confirmed_at },
    { label: "Na Fila",    time: order.queue_entered_at ?? order.confirmed_at },
    { label: "Pronto",     time: order.ready_at },
    { label: "Entregue",   time: order.delivered_at },
    { label: "Cancelado",  time: order.cancelled_at },
  ].filter((e, i, arr) => e.time && (i === 0 || e.time !== arr[i - 1]?.time));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Dialog panel */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg lg:max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-charcoal to-zinc-800 px-5 py-4 text-white shrink-0">
          <div className="absolute right-16 top-0 bottom-0 flex items-center opacity-[0.06]">
            {order.type === "BALCAO" ? <Utensils size={96} /> : <ShoppingBag size={96} />}
          </div>

          <button
            onClick={onClose}
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
                  {order.type === "BALCAO" ? "Balcão" : "Para Viagem"} ·{" "}
                  {order.source === "ATTENDANT" ? "Atendente" : order.source === "QR_CODE" ? "QR Code" : order.source === "APP" ? "App" : "WhatsApp"} ·{" "}
                  Criado às {fmt(order.created_at)}
                </p>
              </div>
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.payment_status} />
              {order.payment_method && order.payment_status !== "PENDING" && (
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">
                  · {PAYMENT_LABEL[order.payment_method] ?? order.payment_method}
                </span>
              )}
            </div>

            {/* Timeline */}
            {!isCANCELADO ? (
              <div className="flex items-center gap-1.5 pt-0.5">
                <TimelineStep label="Criado"   time={fmt(order.created_at)} done />
                <TimelineConnector done={!!order.confirmed_at} />
                <TimelineStep label="Na Fila"  time={order.confirmed_at ? fmt(order.confirmed_at) : undefined} active={isNA_FILA} done={!!order.ready_at || isPRONTO || isENTREGUE} />
                <TimelineConnector done={!!order.ready_at} />
                <TimelineStep label="Pronto"   time={order.ready_at ? fmt(order.ready_at) : undefined} active={isPRONTO} done={isENTREGUE} />
                <TimelineConnector done={isENTREGUE} />
                <TimelineStep label="Entregue" time={order.delivered_at ? fmt(order.delivered_at) : undefined} active={isENTREGUE} done={isENTREGUE} />
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

        {/* ── Body: 2 panels on lg, 1 col on md ──────────────── */}
        <div className="flex flex-1 overflow-hidden min-h-0 flex-col lg:flex-row">

          {/* LEFT — items + financial + history */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 lg:border-r border-zinc-100">

            {/* Items */}
            <div>
              <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Itens do Pedido
              </p>
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <div className="divide-y divide-zinc-100">
                  {order.items?.map((item) => (
                    <div key={item.id} className="p-4 space-y-0.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-sm text-zinc-900">
                              {item.quantity}× {item.product?.name ?? item.product_name_snapshot}
                            </p>
  
                          </div>
                          {item.removed_ingredients && item.removed_ingredients.length > 0 && (
                            <p className="text-[11px] font-bold text-brand-red uppercase mt-0.5">
                              − SEM: {item.removed_ingredients.map((ri) => ri.ingredient?.name ?? ri.ingredient_name_snapshot).join(", ")}
                            </p>
                          )}
                          {item.addons && item.addons.length > 0 && (
                            <p className="text-[11px] font-bold text-emerald-600 uppercase mt-0.5">
                              + {item.addons.map((a) => `${a.quantity}× ${a.addon?.name ?? a.addon_name_snapshot}`).join(", ")}
                            </p>
                          )}
                          {item.observation && (
                            <p className="mt-1 text-[11px] italic text-zinc-400">&ldquo;{item.observation}&rdquo;</p>
                          )}
                        </div>
                        <p className="shrink-0 text-sm font-black text-zinc-700">
                          {currency.format(item.total_price)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Financial summary */}
                <div className="border-t border-zinc-100 bg-zinc-50/80 px-4 py-3 space-y-1.5">
                  {(hasDiscount || hasPacking) && (
                    <div className="flex justify-between text-xs font-semibold text-zinc-500">
                      <span>Subtotal</span>
                      <span>{currency.format(subtotal)}</span>
                    </div>
                  )}
                  {hasPacking && (
                    <div className="flex justify-between text-xs font-semibold text-zinc-500">
                      <span>Embalagem</span>
                      <span>{currency.format(order.packing_fee)}</span>
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
                  <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                      Total Geral
                    </span>
                    <span className={`text-2xl font-black ${
                      order.payment_status === "PAID"     ? "text-emerald-600"
                      : order.payment_status === "COURTESY" ? "text-zinc-600"
                      : "text-brand-red"
                    }`}>
                      {currency.format(order.total_amount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  Observações
                </p>
                <p className="text-sm italic text-zinc-500">&ldquo;{order.notes}&rdquo;</p>
              </div>
            )}

            {/* History (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="flex w-full items-center justify-between px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2"
              >
                <span className="flex items-center gap-1.5">
                  <History size={11} /> Histórico de Status
                </span>
                {showHistory ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
              {showHistory && (
                <div className="overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50 divide-y divide-zinc-100 animate-in fade-in slide-in-from-top-2 duration-150">
                  {historyEvents.map((e) => (
                    <div key={e.label} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs font-bold text-zinc-500">{e.label}</span>
                      <span className="text-xs font-black text-zinc-700">{fmt(e.time!)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — actions */}
          <div className="shrink-0 overflow-y-auto bg-zinc-50/80 p-5 space-y-3 lg:w-72 lg:border-t-0 border-t border-zinc-100">

            {/* Error */}
            {errorMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-red-500" size={14} />
                <p className="text-xs font-bold text-red-700">{errorMsg}</p>
              </div>
            )}

            {/* ─ Default actions ─ */}
            {!showPaymentSelection && !showCancelReason && (
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
                {order.status === "PRONTO" && (
                  <Button
                    className="h-14 w-full rounded-2xl bg-emerald-500 text-base font-black shadow-lg shadow-emerald-200 hover:bg-emerald-600 gap-2"
                    onClick={onDeliver}
                    disabled={isLoading}
                  >
                    <CheckCircle2 size={18} /> ENTREGAR PEDIDO
                  </Button>
                )}

                {/* Payment pending alert */}
                {order.payment_status === "PENDING" && !isCANCELADO && !isAppAwaitingPayment && (
                  <div className="rounded-2xl border-2 border-brand-amber/30 bg-brand-amber/5 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-brand-amber">
                      <AlertTriangle size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        Pagamento Pendente
                      </span>
                    </div>
                    <Button
                      className="h-11 w-full bg-brand-amber text-sm font-black text-brand-charcoal hover:bg-brand-amber/80"
                      onClick={() => setShowPaymentSelection(true)}
                      disabled={isLoading}
                    >
                      RECEBER AGORA
                    </Button>
                  </div>
                )}

                {/* Add to order */}
                {order.payment_status === "PENDING" && ["NA_FILA", "AGUARDANDO_PAGAMENTO"].includes(order.status) && !isAppAwaitingPayment && (
                  <Button
                    variant="outline"
                    className="h-11 w-full rounded-2xl border-2 border-zinc-900 text-sm font-black gap-2"
                    onClick={() => router.push(`/app/novo-pedido?add_to=${order.id}`)}
                    disabled={isLoading}
                  >
                    <PlusCircle size={15} /> ADICIONAR À COMANDA
                  </Button>
                )}

                <hr className="border-zinc-200" />

                {/* Secondary actions */}
                {["NA_FILA", "PRONTO", "ENTREGUE"].includes(order.status) && (
                  <Button
                    variant="outline"
                    className="h-11 w-full rounded-2xl border-2 text-xs font-black text-zinc-600 gap-2"
                    onClick={onReprint}
                    disabled={isLoading}
                  >
                    <Printer size={14} /> REIMPRIMIR
                  </Button>
                )}
                {["AGUARDANDO_CONFIRMACAO", "AGUARDANDO_PAGAMENTO", "NA_FILA", "PRONTO"].includes(order.status) && (
                  <Button
                    variant="outline"
                    className="h-11 w-full rounded-2xl border-2 border-red-100 text-xs font-black text-red-500 hover:bg-red-50 gap-2"
                    onClick={() => setShowCancelReason(true)}
                    disabled={isLoading}
                  >
                    <XCircle size={14} /> CANCELAR PEDIDO
                  </Button>
                )}

                {["ENTREGUE", "CANCELADO", "EXPIRADO"].includes(order.status) &&
                  !["NA_FILA", "PRONTO", "AGUARDANDO_CONFIRMACAO"].includes(order.status) && (
                  <p className="py-4 text-center text-xs font-bold text-zinc-400">
                    Pedido finalizado
                  </p>
                )}
              </>
            )}

            {/* ─ Payment selection ─ */}
            {showPaymentSelection && (
              <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-150">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPaymentSelection(false)}
                    className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-200 transition-colors"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <h4 className="text-xs font-black uppercase tracking-widest text-zinc-700">
                    Forma de Pagamento
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(({ value, label, Icon, color }) => (
                    <button
                      key={value}
                      onClick={() => onMarkPayment(value, "PAID")}
                      disabled={isLoading}
                      className={`flex flex-col items-center justify-center gap-2 h-16 rounded-2xl border-2 text-xs font-black transition-all active:scale-95 disabled:opacity-50 ${color}`}
                    >
                      <Icon size={18} /> {label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => onMarkPayment("COURTESY", "COURTESY")}
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 h-12 rounded-2xl border-2 border-pink-200 bg-pink-50 text-pink-700 text-xs font-black hover:bg-pink-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Gift size={15} /> CORTESIA
                </button>
              </div>
            )}

            {/* ─ Cancel reason ─ */}
            {showCancelReason && (
              <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-150">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setShowCancelReason(false); setErrorMsg(""); }}
                    className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-200 transition-colors"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <h4 className="text-xs font-black uppercase tracking-widest text-red-600">
                    Cancelar Pedido
                  </h4>
                </div>
                <textarea
                  className="h-24 w-full resize-none rounded-xl border border-red-100 bg-white p-3 text-sm font-bold text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-300"
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
      </div>
    </>
  );
}
