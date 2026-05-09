import { Order } from "@/types/pdv";
import { Clock, ShoppingBag, User, Utensils, Package, CheckCircle2 } from "lucide-react";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

interface Props {
  order: Order;
  onClick: (order: Order) => void;
  now: number; // timestamp ms — passed from parent so all cards use the same "now"
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function getStatusEnteredAt(order: Order): string | undefined {
  switch (order.status) {
    case "NA_FILA":     return order.queue_entered_at ?? order.confirmed_at;
    case "PRONTO":      return order.ready_at;
    case "ENTREGUE":    return order.delivered_at;
    case "CANCELADO":   return order.cancelled_at;
    default:            return order.created_at;
  }
}

function ElapsedTimer({ since, now }: { since: string; now: number }) {
  const elapsed = Math.floor((now - new Date(since).getTime()) / 1000 / 60); // minutes

  const colorClass =
    elapsed < 10
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : elapsed < 20
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : "bg-red-50 text-red-600 border-red-100";

  const display = elapsed < 60 ? `${elapsed} min` : `${Math.floor(elapsed / 60)}h${elapsed % 60}m`;

  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase ${colorClass}`}>
      <Clock className="h-2.5 w-2.5" />
      {display}
    </span>
  );
}

function getAccentClass(status: Order["status"]) {
  const map: Record<Order["status"], string> = {
    AGUARDANDO_CONFIRMACAO: "bg-blue-500",
    AGUARDANDO_PAGAMENTO: "bg-brand-amber",
    NA_FILA: "bg-brand-red",
    PRONTO: "bg-emerald-500",
    ENTREGUE: "bg-zinc-400",
    CANCELADO: "bg-red-400",
    EXPIRADO: "bg-zinc-300",
  };
  return map[status] ?? "bg-zinc-300";
}

const ACTIVE_STATUSES: Order["status"][] = ["NA_FILA", "AGUARDANDO_CONFIRMACAO", "PRONTO"];

export function OrderCard({ order, onClick, now }: Props) {
  const isPendingPayment = order.payment_status === "PENDING";
  const time = new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const itemCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  const firstItems = order.items?.slice(0, 2) ?? [];
  const extraItems = Math.max((order.items?.length ?? 0) - 2, 0);
  const accentClass = getAccentClass(order.status);
  const showTimer = ACTIVE_STATUSES.includes(order.status);
  const timerSince = getStatusEnteredAt(order);

  const quickActionLabel =
    order.status === "NA_FILA"
      ? { label: "MARCAR PRONTO", Icon: Package, color: "bg-brand-amber text-brand-charcoal" }
      : order.status === "PRONTO"
      ? { label: "ENTREGAR", Icon: CheckCircle2, color: "bg-emerald-500 text-white" }
      : null;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] cursor-pointer ${
        isPendingPayment ? "border-brand-amber/40 ring-1 ring-brand-amber/30" : "border-zinc-200"
      }`}
      onClick={() => onClick(order)}
    >
      {/* Accent bar */}
      <div className={`h-1 ${accentClass}`} />

      <div className="p-4 space-y-3">
        {/* Row 1: number + time + status + timer */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-charcoal text-white shadow-sm">
              <span className="text-lg font-black leading-none">
                {String(order.daily_number).padStart(2, "0")}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Clock className="h-3 w-3" />
                <span className="text-[10px] font-black uppercase tracking-widest">{time}</span>
                {order.type === "BALCAO" ? (
                  <Utensils className="h-3 w-3 ml-1 text-zinc-500" />
                ) : (
                  <ShoppingBag className="h-3 w-3 ml-1 text-zinc-500" />
                )}
                <span className="text-[10px] font-bold text-zinc-500">
                  {order.type === "BALCAO" ? "Balcão" : "Viagem"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <OrderStatusBadge status={order.status} />
                {showTimer && timerSince && (
                  <ElapsedTimer since={timerSince} now={now} />
                )}
              </div>
            </div>
          </div>
          <PaymentStatusBadge status={order.payment_status} />
        </div>

        {/* Row 2: customer */}
        <div className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2">
          <User className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <span className="truncate text-sm font-bold text-zinc-800">
            {order.customer_name || "Cliente não informado"}
          </span>
          {itemCount > 0 && (
            <span className="ml-auto shrink-0 rounded-md bg-zinc-200 px-1.5 py-0.5 text-[10px] font-black text-zinc-600">
              {itemCount} {itemCount === 1 ? "item" : "itens"}
            </span>
          )}
        </div>

        {/* Row 3: items list */}
        {firstItems.length > 0 && (
          <div className="space-y-1 px-0.5">
            {firstItems.map((item) => (
              <p key={item.id} className="truncate text-xs font-medium text-zinc-500">
                <span className="font-black text-zinc-700">{item.quantity}×</span>{" "}
                {item.product?.name ?? item.product_name_snapshot}
                {item.addons && item.addons.length > 0 && (
                  <span className="text-emerald-600 font-bold">
                    {" "}+{item.addons.map((a) => a.addon?.name ?? a.addon_name_snapshot).join(", ")}
                  </span>
                )}
              </p>
            ))}
            {extraItems > 0 && (
              <p className="text-[10px] font-bold text-zinc-400">+{extraItems} mais...</p>
            )}
          </div>
        )}

        {/* Row 4: total + quick action */}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total</p>
            <span className="text-lg font-black text-zinc-900">{currency.format(order.total_amount)}</span>
          </div>
          {quickActionLabel && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick(order);
              }}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wide shadow-sm transition-all active:scale-95 ${quickActionLabel.color}`}
            >
              <quickActionLabel.Icon className="h-3 w-3" />
              {quickActionLabel.label}
            </button>
          )}
        </div>
      </div>

      {isPendingPayment && order.status !== "CANCELADO" && (
        <div className="border-t border-brand-amber/20 bg-brand-amber/10 px-4 py-2 text-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-brand-amber">
            Aguardando pagamento
          </span>
        </div>
      )}
    </div>
  );
}
