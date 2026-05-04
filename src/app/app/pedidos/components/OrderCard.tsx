import { Order } from "@/types/pdv";
import { Card } from "@/components/ui/Card";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

interface Props {
  order: Order;
  onClick: (order: Order) => void;
}

export function OrderCard({ order, onClick }: Props) {
  const isPendingPayment = order.payment_status === 'PENDING';
  
  return (
    <Card 
      className={`p-4 cursor-pointer active:scale-[0.98] transition-transform ${isPendingPayment ? 'border-amber-400 border-2' : ''}`}
      onClick={() => onClick(order)}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="font-bold text-lg">#{order.daily_number}</span>
          <span className="text-xs text-muted-foreground ml-2">{order.order_type} • {order.source}</span>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      
      {order.customer_name && (
        <div className="text-sm font-medium mb-2 text-foreground/80">
          {order.customer_name} {order.customer_phone ? `(${order.customer_phone})` : ''}
        </div>
      )}
      
      <div className="text-sm text-muted-foreground line-clamp-2 mb-3">
        {order.items?.map(item => `${item.quantity}x ${item.product?.name}`).join(', ')}
      </div>
      
      <div className="flex justify-between items-center mt-2 pt-2 border-t border-border">
        <span className="font-bold">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}
        </span>
        <PaymentStatusBadge status={order.payment_status} />
      </div>
    </Card>
  );
}
