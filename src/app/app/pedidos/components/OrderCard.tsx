import { useState } from "react";
import { Order, OrderItem, OrderItemStatus } from "@/types/pdv";
import { Clock, ShoppingBag, User, Utensils, Package, CheckCircle2, Loader2 } from "lucide-react";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

// Cor de cada estado de item — usada nos chips de progresso embaixo do card.
const ITEM_DOT: Record<OrderItemStatus, string> = {
  PENDING:        "bg-zinc-300",
  IN_PREPARATION: "bg-amber-400",
  READY:          "bg-emerald-500",
  DELIVERED:      "bg-emerald-700",
  CANCELLED:      "bg-zinc-200 ring-1 ring-zinc-300",
};

function ItemProgress({ items, branchCode, dailyNumber }: {
  items: OrderItem[];
  branchCode?: string;
  dailyNumber: number;
}) {
  const active = items.filter((i) => i.status !== "CANCELLED");
  if (active.length < 2) return null; // único item: chips não agregam valor

  const doneCount = active.filter((i) => i.status === "READY" || i.status === "DELIVERED").length;
  const orderLabel = branchCode ? `${branchCode}-${String(dailyNumber).padStart(3, "0")}` : String(dailyNumber);

  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5">
      <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
        {doneCount}/{active.length} prontos
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-1">
        {items.map((i) => (
          <span
            key={i.id}
            title={`${orderLabel}-${i.sequence_no ?? "?"} · ${i.product_name_snapshot} · ${i.status}`}
            className={`h-2.5 w-2.5 rounded-full ${ITEM_DOT[i.status]}`}
          />
        ))}
      </div>
    </div>
  );
}

interface Props {
  order: Order;
  onClick: (order: Order) => void;
  now: number;
  onQuickAction?: (order: Order) => Promise<void>;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function getStatusEnteredAt(order: Order): string | undefined {
  switch (order.status) {
    case "NA_FILA":         return order.queue_entered_at ?? order.confirmed_at;
    case "PRONTO_PARCIAL":  return order.queue_entered_at ?? order.confirmed_at;
    case "PRONTO":          return order.ready_at;
    case "ENTREGUE":        return order.delivered_at;
    case "CANCELADO":       return order.cancelled_at;
    default:                return order.created_at;
  }
}

function ElapsedTimer({ since, now }: { since: string; now: number }) {
  const elapsed = Math.floor((now - new Date(since).getTime()) / 1000 / 60);
  const colorClass =
    elapsed < 10  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
    : elapsed < 20 ? "bg-amber-50 text-amber-700 border-amber-100"
    : "bg-red-50 text-red-600 border-red-100";
  const display = elapsed < 60 ? `${elapsed}min` : `${Math.floor(elapsed / 60)}h${elapsed % 60}m`;
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase ${colorClass}`}>
      <Clock className="h-2.5 w-2.5" />
      {display}
    </span>
  );
}

const ACCENT: Record<Order["status"], string> = {
  AGUARDANDO_CONFIRMACAO: "bg-blue-500",
  AGUARDANDO_PAGAMENTO:   "bg-brand-amber",
  NA_FILA:                "bg-brand-red",
  PRONTO_PARCIAL:         "bg-amber-500",
  PRONTO:                 "bg-emerald-500",
  ENTREGUE:               "bg-zinc-300",
  CANCELADO:              "bg-red-300",
  EXPIRADO:               "bg-zinc-200",
};

const ACTIVE_STATUSES: Order["status"][] = [
  "NA_FILA", "AGUARDANDO_CONFIRMACAO", "AGUARDANDO_PAGAMENTO", "PRONTO_PARCIAL", "PRONTO",
];

export function OrderCard({ order, onClick, now, onQuickAction }: Props) {
  const [quickLoading, setQuickLoading] = useState(false);

  const isPendingPayment = order.payment_status === "PENDING";
  const time = new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const itemCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const firstItems = order.items?.slice(0, 3) ?? [];
  const extraItems = Math.max((order.items?.length ?? 0) - 3, 0);
  const showTimer = ACTIVE_STATUSES.includes(order.status);
  const timerSince = getStatusEnteredAt(order);
  const latestTransaction = order.transactions
    ?.slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  // Urgency level based on elapsed time for active orders
  const elapsed = showTimer && timerSince
    ? Math.floor((now - new Date(timerSince).getTime()) / 1000 / 60)
    : 0;
  const isUrgent  = showTimer && elapsed >= 20;
  const isWarning = showTimer && elapsed >= 10 && elapsed < 20;

  const quickActionConfig =
    order.status === "AGUARDANDO_CONFIRMACAO"
      ? { label: "CONFIRMAR",       Icon: CheckCircle2, color: "bg-emerald-500 text-white hover:bg-emerald-600" }
      : order.status === "NA_FILA"
      ? { label: "PRONTO",          Icon: Package,       color: "bg-brand-amber text-brand-charcoal hover:bg-brand-amber/90" }
      : order.status === "PRONTO_PARCIAL"
      ? { label: "ENTREGAR PRONTOS", Icon: Package,       color: "bg-amber-500 text-white hover:bg-amber-600" }
      : order.status === "PRONTO"
      ? { label: "ENTREGAR",        Icon: CheckCircle2,  color: "bg-emerald-500 text-white hover:bg-emerald-600" }
      : null;

  const handleQuickClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onQuickAction || quickLoading) return;
    setQuickLoading(true);
    try {
      await onQuickAction(order);
    } finally {
      setQuickLoading(false);
    }
  };

  const borderClass = isUrgent
    ? "border-red-300 ring-2 ring-red-300/50"
    : isWarning
    ? "border-amber-200 ring-1 ring-amber-200"
    : isPendingPayment
    ? "border-brand-amber/40 ring-1 ring-brand-amber/20"
    : "border-zinc-200";

  return (
    <div
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${borderClass} ${quickLoading ? "opacity-60 pointer-events-none" : ""}`}
      onClick={() => !quickLoading && onClick(order)}
    >
      {/* Status accent bar */}
      <div className={`h-1 ${ACCENT[order.status]}`} />

      {/* Urgent pulse overlay */}
      {isUrgent && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-red-400/30 animate-pulse" />
      )}

      <div className="p-3.5 space-y-2.5">
        {/* Row 1: number + time + type + timer + payment badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 min-w-[2.5rem] shrink-0 flex-col items-center justify-center rounded-xl bg-brand-charcoal px-1 text-white shadow-sm">
              {order.branch?.code && (
                <span className="text-[8px] font-black leading-none text-zinc-400">{order.branch.code}</span>
              )}
              <span className={`font-black leading-none ${String(order.daily_number).length > 2 ? "text-sm" : "text-base"}`}>
                {String(order.daily_number).padStart(2, "0")}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-widest">{time}</span>
                {order.type === "BALCAO"
                  ? <Utensils className="h-3 w-3 ml-0.5 text-zinc-400" />
                  : <ShoppingBag className="h-3 w-3 ml-0.5 text-zinc-400" />
                }
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <OrderStatusBadge status={order.status} />
                {showTimer && timerSince && <ElapsedTimer since={timerSince} now={now} />}
              </div>
            </div>
          </div>
          <PaymentStatusBadge status={order.payment_status} />
        </div>

        {/* Row 2: customer name + item count */}
        <div className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-1.5">
          <User className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <span className={`flex-1 truncate text-sm font-bold ${order.customer_name ? "text-zinc-800" : "italic text-zinc-400"}`}>
            {order.customer_name || "Cliente final"}
            {order.customer_phone && (
              <span className="ml-1 text-xs font-semibold text-zinc-400">
                {order.customer_phone}
              </span>
            )}
          </span>
          {itemCount > 0 && (
            <span className="ml-auto shrink-0 rounded-md bg-zinc-200 px-1.5 py-0.5 text-[10px] font-black text-zinc-600">
              {itemCount}×
            </span>
          )}
        </div>

        {/* Row 3: item list preview */}
        {order.status === "AGUARDANDO_PAGAMENTO" && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">
            <span className="font-black uppercase">
              {latestTransaction?.internal_payment_method ?? "Pagamento online"}
            </span>
            {latestTransaction?.provider_status && (
              <span className="ml-1 opacity-80">({latestTransaction.provider_status})</span>
            )}
            {latestTransaction?.expires_at && (
              <span className="block text-[10px] uppercase opacity-70">
                Expira {new Date(latestTransaction.expires_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        )}

        {/* Row 3: item list preview */}
        {firstItems.length > 0 && (
          <div className="space-y-0.5 px-0.5">
            {firstItems.map((item) => (
              <p key={item.id} className="truncate text-xs font-medium text-zinc-500 leading-snug">
                {item.sequence_no != null && (
                  <span className="mr-1 inline-block rounded bg-zinc-200 px-1 text-[9px] font-black text-zinc-600">
                    {item.sequence_no}
                  </span>
                )}
                <span className="font-black text-zinc-700">{item.quantity}×</span>{" "}
                {item.product?.name ?? item.product_name_snapshot}
                {item.addons && item.addons.length > 0 && (
                  <span className="text-emerald-600 font-semibold">
                    {" "}+{item.addons.map((a) => a.addon?.name ?? a.addon_name_snapshot).join(", ")}
                  </span>
                )}
                {item.removed_ingredients && item.removed_ingredients.length > 0 && (
                  <span className="text-brand-red font-semibold">
                    {" "}−{item.removed_ingredients.map((ri) => ri.ingredient?.name ?? ri.ingredient_name_snapshot).join(", ")}
                  </span>
                )}
              </p>
            ))}
            {extraItems > 0 && (
              <p className="text-[10px] font-bold text-zinc-400">+{extraItems} mais...</p>
            )}
          </div>
        )}

        {/* Per-item progress chips — só aparece em pedidos com 2+ itens ativos */}
        {order.items && showTimer && (
          <ItemProgress items={order.items} branchCode={order.branch?.code} dailyNumber={order.daily_number} />
        )}

        {/* Row 4: total + quick action */}
        <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-2.5">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Total</p>
            <span className="text-base font-black text-zinc-900">{currency.format(order.total_amount)}</span>
          </div>
          {quickActionConfig && (
            <button
              type="button"
              onClick={handleQuickClick}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide shadow-sm transition-all active:scale-95 ${quickActionConfig.color}`}
            >
              {quickLoading
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <quickActionConfig.Icon className="h-3 w-3" />
              }
              {quickActionConfig.label}
            </button>
          )}
        </div>
      </div>

      {/* Pending payment banner */}
      {isPendingPayment && order.status !== "CANCELADO" && (
        <div className="border-t border-brand-amber/20 bg-brand-amber/8 px-4 py-1.5 text-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-brand-amber">
            Aguardando pagamento
          </span>
        </div>
      )}
    </div>
  );
}
