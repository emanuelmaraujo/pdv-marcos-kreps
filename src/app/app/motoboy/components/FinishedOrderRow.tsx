"use client";

import { DollarSign } from "lucide-react";
import type { Order } from "@/types/pdv";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatTime } from "../motoboy-utils";

/**
 * Linha compacta de uma corrida já encerrada — usada tanto em "Entregues hoje"
 * (tela ao vivo) quanto no histórico por dia.
 */
export function FinishedOrderRow({ order }: { order: Order }) {
  const isDelivered = order.status === "ENTREGUE";
  const isCancelled = order.status === "CANCELADO" || order.status === "EXPIRADO";
  const deliveredAt = order.delivery_delivered_at ?? order.delivered_at;

  const statusBadge = isDelivered ? (
    <Badge variant="success">
      {deliveredAt ? `Entregue às ${formatTime(deliveredAt)}` : "Entregue"}
    </Badge>
  ) : isCancelled ? (
    <Badge variant="destructive">Cancelado</Badge>
  ) : (
    <Badge variant="warning">
      {order.dispatched_at ? `Saiu às ${formatTime(order.dispatched_at)}` : "Na rua"}
    </Badge>
  );

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
      <div className="min-w-0">
        <p className="truncate font-semibold text-[var(--text-primary)]">
          Pedido #{order.daily_number}
          {order.customer_name ? ` · ${order.customer_name}` : ""}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
          {order.delivery_neighborhood || "Bairro não informado"}
          {order.dispatched_at ? ` · saiu às ${formatTime(order.dispatched_at)}` : ""}
        </p>
        <div className="mt-1.5">{statusBadge}</div>
      </div>
      <div className="shrink-0 text-right">
        <p className="flex items-center justify-end gap-1 text-[11px] text-[var(--text-secondary)]">
          <DollarSign className="h-3 w-3" />
          {isDelivered ? "Ganho" : "Taxa"}
        </p>
        <p
          className={`text-sm font-bold ${
            isCancelled ? "text-[var(--text-muted)] line-through" : "text-[var(--status-success)]"
          }`}
        >
          {formatCurrency(order.delivery_fee)}
        </p>
      </div>
    </div>
  );
}
