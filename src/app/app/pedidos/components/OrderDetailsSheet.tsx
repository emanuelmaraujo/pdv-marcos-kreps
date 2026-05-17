import { Order, OrderItem, PaymentMethod, PaymentStatus } from "@/types/pdv";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { OrderItemsControl } from "./OrderItemsControl";
import { PayItemsModal } from "./PayItemsModal";
import { EditOrderItemSheet } from "./EditOrderItemSheet";
import { useState } from "react";
import { pdvApi } from "@/lib/api/pdv-api";
import { useRouter } from "next/navigation";
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
  Clock,
  QrCode,
  Banknote,
  CreditCard,
  Gift,
  Smartphone,
} from "lucide-react";

interface Props {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: () => void;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
            : "border-zinc-300 bg-white"
        }`}
      />
      <p className="text-[9px] font-black uppercase tracking-wide text-zinc-500 text-center leading-tight whitespace-nowrap">
        {label}
      </p>
      {time && <p className="text-[9px] font-bold text-zinc-400">{time}</p>}
    </div>
  );
}

function TimelineConnector({ done }: { done: boolean }) {
  return (
    <div className={`flex-1 h-0.5 rounded-full transition-colors ${done ? "bg-emerald-300" : "bg-zinc-200"}`} />
  );
}

const PAYMENT_METHOD_CONFIG: Record<
  PaymentMethod,
  { label: string; Icon: React.ElementType; colors: string }
> = {
  PIX:         { label: "PIX",          Icon: QrCode,      colors: "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100" },
  CASH:        { label: "Dinheiro",     Icon: Banknote,    colors: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
  DEBIT_CARD:  { label: "Débito",       Icon: CreditCard,  colors: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" },
  CREDIT_CARD: { label: "Crédito",      Icon: CreditCard,  colors: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100" },
  IFOOD:       { label: "iFood",        Icon: Smartphone,  colors: "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100" },
  COURTESY:    { label: "Cortesia",     Icon: Gift,        colors: "border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100" },
  PENDING:     { label: "Pendente",     Icon: Clock,       colors: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" },
};

export function OrderDetailsSheet({ order, isOpen, onClose, onOrderUpdated }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);
  const [showPayItems, setShowPayItems] = useState(false);
  const [showChangeMethod, setShowChangeMethod] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);

  if (!order) return null;

  const handleAction = async (action: () => Promise<unknown>) => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      await action();
      onOrderUpdated();
      onClose();
    } catch (err: unknown) {
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
  const onChangeMethod = (method: PaymentMethod) =>
    handleAction(async () => {
      await pdvApi.changePaymentMethod({ orderId: order.id, paymentMethod: method });
      setShowChangeMethod(false);
    });
  const onReprint = () =>
    handleAction(() => pdvApi.reprintOrder({
      orderId: order.id,
      copies: order.source === "APP" ? ["KITCHEN", "JUICE_POTATO"] : ["CUSTOMER", "KITCHEN", "JUICE_POTATO"],
    }));

  // Timeline logic
  const isNA_FILA = order.status === "NA_FILA";
  const isPRONTO  = order.status === "PRONTO";
  const isENTREGUE = order.status === "ENTREGUE";
  const isCANCELADO = order.status === "CANCELADO";

  const hasDiscount = order.discount_amount > 0;
  const hasPacking  = order.packing_fee > 0;
  const subtotal = order.total_amount + order.discount_amount - order.packing_fee;
  const isAppAwaitingPayment = order.source === "APP" && order.status === "AGUARDANDO_PAGAMENTO";
  const isPaid = order.payment_status === "PAID" || order.payment_status === "COURTESY";

  const queueEnteredAt = order.queue_entered_at ?? order.confirmed_at;
  const elapsedMin = isENTREGUE && order.delivered_at && queueEnteredAt
    ? Math.round((new Date(order.delivered_at).getTime() - new Date(queueEnteredAt).getTime()) / 60000)
    : null;
  const elapsedLabel = elapsedMin !== null
    ? elapsedMin < 60
      ? `${elapsedMin} min`
      : `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}min`
    : null;

  return (
    <>
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`Pedido #${String(order.daily_number).padStart(2, "0")}`}>
      <div className="flex flex-col gap-5 pb-10">

        {/* Error */}
        {errorMsg && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <AlertTriangle className="shrink-0 text-red-500" size={18} />
            <p className="text-sm font-bold text-red-700">{errorMsg}</p>
          </div>
        )}

        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-charcoal to-zinc-700 p-5 text-white shadow-lg">
          <div className="absolute right-4 top-4 opacity-10">
            {order.type === "BALCAO" ? (
              <Utensils size={64} />
            ) : (
              <ShoppingBag size={64} />
            )}
          </div>
          <div className="relative space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  {order.type === "BALCAO" ? "Balcão" : "Para Viagem"} · {order.source === "APP" ? "App" : order.source}
                </p>
                <h2 className="mt-0.5 text-2xl font-black leading-tight">
                  {order.customer_name || "Cliente Final"}
                </h2>
                <p className="mt-1 text-sm text-zinc-300">
                  <Clock size={12} className="inline mr-1 opacity-70" />
                  Criado às {fmt(order.created_at)}
                  {elapsedLabel && (
                    <span className="ml-2 font-black text-emerald-400">{elapsedLabel}</span>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <OrderStatusBadge status={order.status} />
                <PaymentStatusBadge status={order.payment_status} />
              </div>
            </div>

            {/* Timeline */}
            {!isCANCELADO && (
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
            {isCANCELADO && (
              <p className="text-xs font-bold text-red-300 uppercase tracking-widest">
                Cancelado às {order.cancelled_at ? fmt(order.cancelled_at) : "—"}
              </p>
            )}
          </div>
        </div>

        {/* Items com controles por item */}
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Itens do Pedido</p>
          <OrderItemsControl order={order} onMutated={onOrderUpdated} onEditItem={setEditingItem} />

          {/* Financial summary */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="bg-zinc-50/80 p-4 space-y-2">
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
                  <span>Desconto</span>
                  <span>- {currency.format(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Geral</span>
                <span className={`text-2xl font-black ${order.payment_status === "PAID" ? "text-emerald-600" : "text-brand-red"}`}>
                  {currency.format(order.total_amount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
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
                <Button
                  className="h-14 w-full rounded-2xl bg-brand-amber text-lg font-black text-brand-charcoal shadow-lg shadow-brand-amber/20 hover:bg-brand-amber/90 gap-2"
                  onClick={onReady}
                  disabled={isLoading}
                >
                  <Package size={20} /> MARCAR PRONTO
                </Button>
              )}
              {order.status === "PRONTO" && (
                <Button
                  className="h-14 w-full rounded-2xl bg-emerald-500 text-lg font-black shadow-lg shadow-emerald-200 hover:bg-emerald-600 gap-2"
                  onClick={onDeliver}
                  disabled={isLoading}
                >
                  <CheckCircle2 size={20} /> ENTREGAR PEDIDO
                </Button>
              )}

              {/* Payment pending / partial alert */}
              {(order.payment_status === "PENDING" || order.payment_status === "PARTIAL") && order.status !== "CANCELADO" && !isAppAwaitingPayment && (
                <div className="rounded-2xl border-2 border-brand-amber/30 bg-brand-amber/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-brand-amber">
                    <AlertTriangle size={16} />
                    <span className="text-xs font-black uppercase tracking-widest">
                      {order.payment_status === "PARTIAL" ? "Pagamento Parcial" : "Pagamento Pendente"}
                    </span>
                  </div>
                  {(order.items?.length ?? 0) > 1 ? (
                    <div className="flex gap-2">
                      <Button
                        className="h-12 flex-1 bg-brand-amber font-black text-brand-charcoal hover:bg-brand-amber/80 text-xs"
                        onClick={() => setShowPayItems(true)}
                        disabled={isLoading}
                      >
                        PAGAR ITENS
                      </Button>
                      <Button
                        className="h-12 flex-1 bg-brand-charcoal font-black text-white hover:bg-zinc-700 text-xs"
                        onClick={() => setShowPaymentSelection(true)}
                        disabled={isLoading}
                      >
                        PAGAR TUDO
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="h-12 w-full bg-brand-amber font-black text-brand-charcoal hover:bg-brand-amber/80"
                      onClick={() => setShowPaymentSelection(true)}
                      disabled={isLoading}
                    >
                      RECEBER AGORA
                    </Button>
                  )}
                </div>
              )}

              {/* Add to order */}
              {order.payment_status === "PENDING" && ["NA_FILA", "AGUARDANDO_PAGAMENTO"].includes(order.status) && !isAppAwaitingPayment && (
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-2xl border-2 border-zinc-900 font-black gap-2"
                  onClick={() => router.push(`/app/novo-pedido?add_to=${order.id}`)}
                  disabled={isLoading}
                >
                  <PlusCircle size={18} /> ADICIONAR À COMANDA
                </Button>
              )}

              {/* Alterar pagamento */}
              {isPaid && !isCANCELADO && (
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-2xl border-2 font-black text-xs text-zinc-600 gap-2"
                  onClick={() => setShowChangeMethod(true)}
                  disabled={isLoading}
                >
                  <ArrowLeft size={14} className="rotate-180" /> ALTERAR PAGAMENTO
                </Button>
              )}

              {/* Secondary actions */}
              <div className="grid grid-cols-2 gap-3">
                {["NA_FILA", "PRONTO", "ENTREGUE"].includes(order.status) && (
                  <Button
                    variant="outline"
                    className="h-12 rounded-2xl border-2 font-black text-xs text-zinc-600 gap-2"
                    onClick={onReprint}
                    disabled={isLoading}
                  >
                    <Printer size={14} /> REIMPRIMIR
                  </Button>
                )}
                {["AGUARDANDO_CONFIRMACAO", "AGUARDANDO_PAGAMENTO", "NA_FILA", "PRONTO"].includes(order.status) && (
                  <Button
                    variant="outline"
                    className="h-12 rounded-2xl border-2 border-red-100 font-black text-xs text-red-500 hover:bg-red-50 gap-2"
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
                <button onClick={() => setShowChangeMethod(false)} className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100">
                  <ArrowLeft size={18} />
                </button>
                <h4 className="text-sm font-black uppercase tracking-widest text-zinc-900">Alterar Pagamento</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["PIX", "DEBIT_CARD", "CREDIT_CARD", "CASH"] as PaymentMethod[]).map((method) => {
                  const { label, Icon, colors } = PAYMENT_METHOD_CONFIG[method];
                  const isCurrent = order.payment_method === method;
                  return (
                    <button
                      key={method}
                      onClick={() => onChangeMethod(method)}
                      disabled={isLoading || isCurrent}
                      className={`flex items-center justify-center gap-2 h-14 rounded-2xl border-2 font-black text-sm transition-all active:scale-95 ${colors} ${isCurrent ? "ring-2 ring-current ring-offset-1 opacity-70" : ""}`}
                    >
                      <Icon size={16} /> {label}
                    </button>
                  );
                })}
                <button
                  onClick={() => onChangeMethod("IFOOD")}
                  disabled={isLoading || order.payment_method === "IFOOD"}
                  className={`col-span-2 flex items-center justify-center gap-2 h-12 rounded-2xl border-2 font-black text-sm transition-all active:scale-95 ${PAYMENT_METHOD_CONFIG.IFOOD.colors} ${order.payment_method === "IFOOD" ? "ring-2 ring-current ring-offset-1 opacity-70" : ""}`}
                >
                  <Smartphone size={16} /> IFOOD
                </button>
              </div>
            </div>
          )}

          {/* Payment selection */}
          {showPaymentSelection && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPaymentSelection(false)} className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100">
                  <ArrowLeft size={18} />
                </button>
                <h4 className="text-sm font-black uppercase tracking-widest text-zinc-900">Forma de Pagamento</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["PIX", "DEBIT_CARD", "CREDIT_CARD", "CASH"] as PaymentMethod[]).map((method) => {
                  const { label, Icon, colors } = PAYMENT_METHOD_CONFIG[method];
                  return (
                    <button
                      key={method}
                      onClick={() => onMarkPayment(method, "PAID")}
                      disabled={isLoading}
                      className={`flex items-center justify-center gap-2 h-14 rounded-2xl border-2 font-black text-sm transition-all active:scale-95 ${colors}`}
                    >
                      <Icon size={16} /> {label}
                    </button>
                  );
                })}
                <button
                  onClick={() => onMarkPayment("IFOOD", "PAID")}
                  disabled={isLoading}
                  className={`col-span-2 flex items-center justify-center gap-2 h-12 rounded-2xl border-2 font-black text-sm transition-all active:scale-95 ${PAYMENT_METHOD_CONFIG.IFOOD.colors}`}
                >
                  <Smartphone size={16} /> IFOOD
                </button>
                <button
                  onClick={() => onMarkPayment("COURTESY", "COURTESY")}
                  disabled={isLoading}
                  className={`col-span-2 flex items-center justify-center gap-2 h-12 rounded-2xl border-2 font-black text-sm transition-all active:scale-95 ${PAYMENT_METHOD_CONFIG.COURTESY.colors}`}
                >
                  <Gift size={16} /> CORTESIA
                </button>
              </div>
            </div>
          )}

          {/* Cancel reason */}
          {showCancelReason && (
            <div className="space-y-4 rounded-2xl border-2 border-red-100 bg-red-50 p-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2 text-red-600">
                <XCircle size={18} />
                <h4 className="text-sm font-black uppercase tracking-widest">Cancelar Pedido</h4>
              </div>
              <input
                type="text"
                className="w-full rounded-xl border border-red-100 bg-white p-4 font-bold text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-300"
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
        </div>
      </div>
    </BottomSheet>
    {showPayItems && (
      <PayItemsModal
        order={order}
        onClose={() => setShowPayItems(false)}
        onPaid={() => { setShowPayItems(false); onOrderUpdated(); onClose(); }}
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
