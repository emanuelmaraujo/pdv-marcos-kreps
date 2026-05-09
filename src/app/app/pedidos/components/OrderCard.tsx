import { Order } from "@/types/pdv";
import { Card } from "@/components/ui/Card";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { Clock, User, Utensils, ShoppingBag } from "lucide-react";

interface Props {
  order: Order;
  onClick: (order: Order) => void;
}

export function OrderCard({ order, onClick }: Props) {
  const isPendingPayment = order.payment_status === 'PENDING';
  const time = new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const itemSummary = order.items
    ?.map(item => `${item.quantity}x ${item.product?.name ?? item.product_name_snapshot}`)
    .join(' • ');
  
  return (
    <Card 
      className={`p-0 overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200 border-zinc-200 shadow-sm hover:shadow-md ${isPendingPayment ? 'ring-2 ring-brand-amber/50' : ''}`}
      onClick={() => onClick(order)}
    >
      <div className="flex">
        {/* Lado Esquerdo: Info Rápida */}
        <div className={`w-2 ${order.status === 'CANCELADO' ? 'bg-zinc-400' : 'bg-brand-red'}`} />
        
        <div className="flex-1 p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center space-x-3">
              <div className="bg-zinc-900 text-white w-12 h-12 rounded-xl flex items-center justify-center">
                <span className="font-black text-xl leading-none">
                  {String(order.daily_number).padStart(2, '0')}
                </span>
              </div>
              <div>
                <div className="flex items-center space-x-1 text-zinc-400">
                  <Clock size={12} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{time}</span>
                </div>
                <div className="flex items-center space-x-1 mt-0.5">
                  {order.type === 'BALCAO' ? <Utensils size={14} className="text-zinc-600" /> : <ShoppingBag size={14} className="text-zinc-600" />}
                  <span className="text-xs font-bold text-zinc-600 uppercase tracking-tight">{order.type}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end space-y-1">
              <OrderStatusBadge status={order.status} />
            </div>
          </div>
          
          <div className="space-y-2 mb-4">
            {order.customer_name ? (
              <div className="flex items-center text-zinc-900 font-bold text-sm bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                <User size={14} className="mr-2 text-zinc-400" />
                <span className="truncate">{order.customer_name}</span>
              </div>
            ) : (
              <div className="text-xs font-medium text-zinc-400 px-1 italic">
                Sem identificação do cliente
              </div>
            )}
            
            <div className="text-[11px] text-zinc-500 font-medium line-clamp-1 px-1">
              {itemSummary}
            </div>
          </div>
          
          <div className="flex justify-between items-center pt-3 border-t border-zinc-100">
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">Total do Pedido</p>
              <span className="text-lg font-black text-zinc-900 leading-none">
                <span className="text-xs mr-0.5">R$</span>
                {order.total_amount.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <PaymentStatusBadge status={order.payment_status} />
          </div>
        </div>
      </div>
      
      {isPendingPayment && order.status !== 'CANCELADO' && (
        <div className="bg-brand-amber/10 px-4 py-1.5 border-t border-brand-amber/20 flex items-center justify-center">
          <span className="text-[10px] font-black text-brand-amber uppercase tracking-widest animate-pulse">
            Aguardando Pagamento
          </span>
        </div>
      )}
    </Card>
  );
}
