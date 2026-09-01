import { useState } from "react";
import { Order, OrderItem, OrderItemStatus } from "@/types/pdv";
import { Clock, ShoppingBag, User, Utensils, Package, CheckCircle2, Loader2, Bike } from "lucide-react";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

// Cor de cada estado de item — usada nos chips de progresso embaixo do card.
const ITEM_DOT: Record<OrderItemStatus, string> = {
  PENDING:        "bg-[var(--text-muted)]/40",
  IN_PREPARATION: "bg-[var(--status-warning)]",
  READY:          "bg-[var(--status-success)]",
  DELIVERED:      "bg-[var(--status-success)] opacity-60",
  CANCELLED:      "bg-[var(--bg-subtle)] ring-1 ring-[var(--border)]",
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
    <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-subtle)] px-2.5 py-1.5">
      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
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
  /** Marca o pedido como entregue direto da fila, pulando o estado PRONTO
   * (útil pra balcão/viagem servidos na hora). Não se aplica a ENTREGA. */
  onMarkDelivered?: (order: Order) => Promise<void>;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Badge prominente de tipo de pedido.
 * VIAGEM é destacado em laranja (warning) com texto "VIAGEM" — não dá pra perder.
 * BALCÃO fica em cinza neutro com texto "BALCÃO".
 */
function OrderTypeBadge({ type }: { type: Order["type"] }) {
  const isViagem = type === "VIAGEM";
  const isEntrega = type === "ENTREGA";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        isEntrega
          ? "bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/30"
          : isViagem
          ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)] ring-1 ring-[var(--status-warning)]/30"
          : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] ring-1 ring-[var(--border)]"
      }`}
      title={isEntrega ? "Pedido para entrega" : isViagem ? "Pedido para viagem" : "Pedido para o balcão"}
    >
      {isEntrega
        ? <Bike className="h-2.5 w-2.5" strokeWidth={2.25} />
        : isViagem
        ? <ShoppingBag className="h-2.5 w-2.5" strokeWidth={2.25} />
        : <Utensils className="h-2.5 w-2.5" strokeWidth={2.25} />}
      {isEntrega ? "Entrega" : isViagem ? "Viagem" : "Balcão"}
    </span>
  );
}

function ElapsedTimer({ since, now }: { since: string; now: number }) {
  const elapsed = Math.floor((now - new Date(since).getTime()) / 1000 / 60);
  const colorClass =
    elapsed < 10  ? "bg-[var(--status-success-bg)] text-[var(--status-success)]"
    : elapsed < 20 ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)]"
    : "bg-[var(--status-danger-bg)] text-[var(--status-danger)]";
  const display = elapsed < 60 ? `${elapsed}min` : `${Math.floor(elapsed / 60)}h${elapsed % 60}m`;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorClass}`}>
      <Clock className="h-2.5 w-2.5" />
      {display}
    </span>
  );
}

const ACCENT: Record<Order["status"], string> = {
  AGUARDANDO_CONFIRMACAO: "bg-[var(--status-warning)]",
  AGUARDANDO_PAGAMENTO:   "bg-[var(--status-warning)]",
  NA_FILA:                "bg-[var(--status-info)]",
  PRONTO_PARCIAL:         "bg-[var(--status-warning)]",
  PRONTO:                 "bg-[var(--status-success)]",
  SAIU_PARA_ENTREGA:      "bg-blue-500",
  ENTREGUE:               "bg-[var(--status-neutral)]",
  CANCELADO:              "bg-[var(--status-danger)]",
  EXPIRADO:               "bg-[var(--status-neutral)]",
};

const ACTIVE_STATUSES: Order["status"][] = [
  "NA_FILA", "AGUARDANDO_CONFIRMACAO", "AGUARDANDO_PAGAMENTO", "PRONTO_PARCIAL", "PRONTO", "SAIU_PARA_ENTREGA",
];

export function OrderCard({ order, onClick, now, onQuickAction, onMarkDelivered }: Props) {
  const [quickLoading, setQuickLoading] = useState(false);
  const [deliverLoading, setDeliverLoading] = useState(false);

  const isPendingPayment = order.payment_status === "PENDING" || order.payment_status === "PARTIAL";
  const time = new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const itemCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const firstItems = order.items?.slice(0, 3) ?? [];
  const extraItems = Math.max((order.items?.length ?? 0) - 3, 0);
  const isActive = ACTIVE_STATUSES.includes(order.status);
  const latestTransaction = order.transactions
    ?.slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  // Ponto de partida: quando entrou na fila. Usado como base de tempo em TODOS os estados.
  const queueEnteredAt = order.queue_entered_at ?? order.confirmed_at;

  // Timer ao vivo — só para pedidos ativos, contando desde a entrada na fila
  const activeElapsedMin = isActive && queueEnteredAt
    ? Math.floor((now - new Date(queueEnteredAt).getTime()) / 1000 / 60)
    : null;

  // Tempo estático para pedidos entregues: da fila até a entrega
  const deliveredElapsedMin = order.status === "ENTREGUE" && order.delivered_at && queueEnteredAt
    ? Math.round((new Date(order.delivered_at).getTime() - new Date(queueEnteredAt).getTime()) / 60000)
    : null;

  const elapsed = activeElapsedMin ?? 0;
  const isUrgent  = isActive && elapsed >= 20;
  const isWarning = isActive && elapsed >= 10 && elapsed < 20;
  // Banner/borda de pagamento pendente para pedidos ativos E para entregues não pagos
  const showPendingPayBanner = isPendingPayment && order.status !== "CANCELADO" && order.status !== "EXPIRADO";

  // Pedidos de ENTREGA em PRONTO não têm ação rápida: despachar exige escolher/confirmar
  // o entregador no OrderDetailsSheet, não cabe num toque só no card.
  const quickActionConfig =
    order.status === "AGUARDANDO_CONFIRMACAO"
      ? { label: "Confirmar",       Icon: CheckCircle2, color: "bg-[var(--status-success)] text-white hover:opacity-90" }
      : order.status === "NA_FILA"
      ? { label: "Pronto",          Icon: Package,      color: "bg-[var(--status-warning)] text-white hover:opacity-90" }
      : order.status === "PRONTO_PARCIAL"
      ? { label: "Entregar prontos", Icon: Package,      color: "bg-[var(--status-warning)] text-white hover:opacity-90" }
      : order.status === "PRONTO" && order.type !== "ENTREGA"
      ? { label: "Entregar",        Icon: CheckCircle2, color: "bg-[var(--status-success)] text-white hover:opacity-90" }
      : order.status === "SAIU_PARA_ENTREGA"
      ? { label: "Confirmar entrega", Icon: CheckCircle2, color: "bg-[var(--status-success)] text-white hover:opacity-90" }
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

  // Botão extra só na fila (NA_FILA) pra balcão/viagem servidos na hora —
  // pula o estado PRONTO e vai direto pra ENTREGUE. ENTREGA sempre passa
  // por despacho, então não ganha esse atalho.
  const canDeliverFromQueue = !!onMarkDelivered && order.status === "NA_FILA" && order.type !== "ENTREGA";

  const handleDeliverClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onMarkDelivered || deliverLoading) return;
    setDeliverLoading(true);
    try {
      await onMarkDelivered(order);
    } finally {
      setDeliverLoading(false);
    }
  };

  const borderClass = isUrgent
    ? "border-[var(--status-danger)]/40 ring-2 ring-[var(--status-danger)]/20"
    : isWarning
    ? "border-[var(--status-warning)]/40 ring-1 ring-[var(--status-warning)]/20"
    : showPendingPayBanner
    ? "border-[var(--status-warning)]/30 ring-1 ring-[var(--status-warning)]/10"
    : "border-[var(--border)]";

  return (
    <div
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:scale-[0.98] ${borderClass} ${quickLoading || deliverLoading ? "opacity-60 pointer-events-none" : ""}`}
      onClick={() => !quickLoading && !deliverLoading && onClick(order)}
    >
      {/* Status accent bar */}
      <div className={`h-1 ${ACCENT[order.status]}`} />

      {/* Urgent pulse overlay */}
      {isUrgent && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-[var(--status-danger)]/20 animate-pulse" />
      )}

      <div className="p-3.5 space-y-2.5">
        {/* Row 1: number + time + type + timer + payment badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 min-w-[2.5rem] shrink-0 flex-col items-center justify-center rounded-xl bg-brand-charcoal px-1 text-white shadow-[var(--shadow-sm)]">
              {order.branch?.code && (
                <span className="text-[8px] font-semibold leading-none text-[var(--text-muted)]">{order.branch.code}</span>
              )}
              <span className={`font-bold leading-none ${String(order.daily_number).length > 2 ? "text-sm" : "text-base"}`}>
                {String(order.daily_number).padStart(2, "0")}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <Clock className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                <span className="text-[11px] font-medium tabular-nums">{time}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <OrderTypeBadge type={order.type} />
                <OrderStatusBadge status={order.status} />
                {activeElapsedMin !== null && <ElapsedTimer since={queueEnteredAt!} now={now} />}
                {deliveredElapsedMin !== null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--status-neutral-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                    <Clock className="h-2.5 w-2.5" />
                    {deliveredElapsedMin < 60
                      ? `${deliveredElapsedMin}min`
                      : `${Math.floor(deliveredElapsedMin / 60)}h${deliveredElapsedMin % 60}m`}
                  </span>
                )}
              </div>
            </div>
          </div>
          <PaymentStatusBadge status={order.payment_status} />
        </div>

        {/* Row 2: customer name + item count */}
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5">
          <User className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" strokeWidth={1.75} />
          <span className={`flex-1 truncate text-sm font-semibold ${order.customer_name ? "text-[var(--text-primary)]" : "italic text-[var(--text-muted)]"}`}>
            {order.customer_name || "Cliente final"}
            {order.customer_phone && (
              <span className="ml-1 text-xs font-medium text-[var(--text-muted)]">
                {order.customer_phone}
              </span>
            )}
          </span>
          {itemCount > 0 && (
            <span className="ml-auto shrink-0 rounded-full bg-[var(--border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
              {itemCount}×
            </span>
          )}
        </div>

        {/* Row 3: payment pending banner */}
        {order.status === "AGUARDANDO_PAGAMENTO" && (
          <div className="rounded-xl bg-[var(--status-warning-bg)] px-3 py-2 text-[11px] font-semibold text-[var(--status-warning)]">
            <span>
              {latestTransaction?.internal_payment_method ?? "Pagamento online"}
            </span>
            {latestTransaction?.provider_status && (
              <span className="ml-1 opacity-80">({latestTransaction.provider_status})</span>
            )}
            {latestTransaction?.expires_at && (
              <span className="block text-[10px] opacity-70">
                Expira {new Date(latestTransaction.expires_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        )}

        {/* Row 3: item list preview */}
        {firstItems.length > 0 && (
          <div className="space-y-0.5 px-0.5">
            {firstItems.map((item) => (
              <p key={item.id} className="truncate text-xs font-medium text-[var(--text-secondary)] leading-snug">
                {item.sequence_no != null && (
                  <span className="mr-1 inline-block rounded bg-[var(--bg-subtle)] px-1 text-[9px] font-semibold text-[var(--text-secondary)]">
                    {item.sequence_no}
                  </span>
                )}
                <span className="font-semibold text-[var(--text-primary)]">{item.quantity}×</span>{" "}
                {item.product?.name ?? item.product_name_snapshot}
                {item.addons && item.addons.length > 0 && (
                  <span className="text-[var(--status-success)] font-semibold">
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
              <p className="text-[11px] font-medium text-[var(--text-muted)]">+{extraItems} mais...</p>
            )}
          </div>
        )}

        {/* Per-item progress chips — só aparece em pedidos com 2+ itens ativos */}
        {order.items && isActive && (
          <ItemProgress items={order.items} branchCode={order.branch?.code} dailyNumber={order.daily_number} />
        )}

        {/* Row 4: total + quick action */}
        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5">
          <div className="text-right">
            <p className="text-[10px] font-medium text-[var(--text-muted)]">Total</p>
            <span className="text-base font-semibold text-[var(--text-primary)] tabular-nums">
              <span className="mr-0.5 text-xs text-[var(--text-secondary)]">R$</span>
              {currency.format(order.total_amount).replace("R$", "").trim()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {canDeliverFromQueue && (
              <button
                type="button"
                onClick={handleDeliverClick}
                className="flex items-center gap-1.5 rounded-full bg-[var(--status-success)] px-3 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-sm)] active:scale-95 hover:opacity-90"
              >
                {deliverLoading
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <CheckCircle2 className="h-3 w-3" />
                }
                Entregue
              </button>
            )}
            {quickActionConfig && (
              <button
                type="button"
                onClick={handleQuickClick}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-[var(--shadow-sm)] active:scale-95 ${quickActionConfig.color}`}
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
      </div>

      {/* Pending payment banner — só para pedidos ainda ativos */}
      {showPendingPayBanner && (
        <div className="bg-[var(--status-warning-bg)] px-4 py-1.5 text-center">
          <span className="text-[11px] font-semibold text-[var(--status-warning)]">
            Aguardando pagamento
          </span>
        </div>
      )}
    </div>
  );
}
