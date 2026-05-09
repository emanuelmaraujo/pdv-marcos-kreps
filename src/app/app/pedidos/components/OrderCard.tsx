import { Card } from "@/components/ui/Card";
import { Order } from "@/types/pdv";
import { Clock, ShoppingBag, User, Utensils } from "lucide-react";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

interface Props {
  order: Order;
  onClick: (order: Order) => void;
}

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function OrderCard({ order, onClick }: Props) {
  const isPendingPayment = order.payment_status === "PENDING";
  const time = new Date(order.created_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const itemCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const itemSummary = order.items
    ?.slice(0, 3)
    .map((item) => `${item.quantity}x ${item.product?.name ?? item.product_name_snapshot}`)
    .join(" • ");
  const extraItems = Math.max((order.items?.length ?? 0) - 3, 0);
  const accentClass = getAccentClass(order.status);

  return (
    <Card
      className={`group overflow-hidden border-zinc-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${
        isPendingPayment ? "ring-2 ring-brand-amber/40" : ""
      }`}
      onClick={() => onClick(order)}
    >
      <button className="block w-full cursor-pointer text-left" type="button">
        <div className={`h-1.5 ${accentClass}`} />

        <div className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-charcoal text-white shadow-sm">
                <span className="text-xl font-black leading-none">
                  {String(order.daily_number).padStart(2, "0")}
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{time}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  {order.type === "BALCAO" ? (
                    <Utensils className="h-3.5 w-3.5 text-zinc-600" />
                  ) : (
                    <ShoppingBag className="h-3.5 w-3.5 text-zinc-600" />
                  )}
                  <span className="truncate text-xs font-black uppercase text-zinc-700">
                    {order.type === "BALCAO" ? "Balcão" : "Viagem"}
                  </span>
                  {itemCount > 0 && (
                    <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-black text-zinc-500">
                      {itemCount} itens
                    </span>
                  )}
                </div>
              </div>
            </div>

            <OrderStatusBadge status={order.status} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm font-bold text-zinc-900">
              <User className="mr-2 h-4 w-4 shrink-0 text-zinc-400" />
              <span className="truncate">{order.customer_name || "Cliente não informado"}</span>
            </div>

            <p className="min-h-5 truncate px-1 text-xs font-medium text-zinc-500">
              {itemSummary || "Sem itens registrados"}
              {extraItems > 0 ? ` +${extraItems}` : ""}
            </p>
          </div>

          <div className="flex items-end justify-between gap-3 border-t border-zinc-100 pt-3">
            <div>
              <p className="mb-1 text-[10px] font-black uppercase leading-none tracking-widest text-zinc-400">
                Total do pedido
              </p>
              <span className="text-lg font-black leading-none text-zinc-950">
                {currency.format(order.total_amount)}
              </span>
            </div>
            <PaymentStatusBadge status={order.payment_status} />
          </div>
        </div>

        {isPendingPayment && order.status !== "CANCELADO" && (
          <div className="border-t border-brand-amber/20 bg-brand-amber/10 px-4 py-2 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-amber">
              Aguardando pagamento
            </span>
          </div>
        )}
      </button>
    </Card>
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
