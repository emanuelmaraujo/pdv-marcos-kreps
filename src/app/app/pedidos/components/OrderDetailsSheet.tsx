import { Order, PaymentMethod, PaymentStatus } from "@/types/pdv";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { useState } from "react";
import { pdvApi } from "@/lib/api/pdv-api";
import { useRouter } from "next/navigation";
import { PlusCircle, Printer, CheckCircle2, Package, XCircle, AlertTriangle, ArrowLeft, Utensils, ShoppingBag, Clock } from "lucide-react";

interface Props {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: () => void;
}

export function OrderDetailsSheet({ order, isOpen, onClose, onOrderUpdated }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);

  if (!order) return null;

  const handleAction = async (action: () => Promise<unknown>) => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      await action();
      onOrderUpdated();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Ocorreu um erro na ação.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onConfirm = () => handleAction(() => pdvApi.confirmOrder(order.id));
  const onReady = () => handleAction(() => pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "PRONTO" }));
  const onDeliver = () => {
    if (order.payment_status === "PENDING") {
      const confirm = window.confirm("ATENÇÃO: Pagamento PENDENTE. Confirmar entrega?");
      if (!confirm) return;
    }
    handleAction(() => pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "ENTREGUE" }));
  };
  
  const onCancel = () => {
    if (!cancelReason.trim()) {
      setErrorMsg("Motivo obrigatório.");
      return;
    }
    handleAction(() => pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "CANCELADO", reason: cancelReason }));
  };

  const onMarkPayment = (method: PaymentMethod, pStatus: PaymentStatus) => {
    handleAction(() => pdvApi.markPayment({ orderId: order.id, paymentMethod: method, status: pStatus, amount: order.total_amount }));
  };

  const onReprint = () => {
    handleAction(() => pdvApi.reprintOrder({ orderId: order.id, copies: ['CUSTOMER', 'KITCHEN', 'JUICE_POTATO'] }));
  };

  const renderPaymentSelection = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center space-x-2 mb-2">
        <button onClick={() => setShowPaymentSelection(false)} className="p-2 -ml-2 text-zinc-400">
          <ArrowLeft size={20} />
        </button>
        <h4 className="font-black text-zinc-900 uppercase tracking-widest text-sm">Forma de Pagamento</h4>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-14 font-black border-2 text-xs" onClick={() => onMarkPayment('PIX', 'PAID')} disabled={isLoading}>PIX</Button>
        <Button variant="outline" className="h-14 font-black border-2 text-xs" onClick={() => onMarkPayment('DEBIT_CARD', 'PAID')} disabled={isLoading}>DÉBITO</Button>
        <Button variant="outline" className="h-14 font-black border-2 text-xs" onClick={() => onMarkPayment('CREDIT_CARD', 'PAID')} disabled={isLoading}>CRÉDITO</Button>
        <Button variant="outline" className="h-14 font-black border-2 text-xs" onClick={() => onMarkPayment('CASH', 'PAID')} disabled={isLoading}>DINHEIRO</Button>
        <Button variant="outline" className="h-14 font-black border-2 text-xs col-span-2" onClick={() => onMarkPayment('COURTESY', 'COURTESY')} disabled={isLoading}>CORTESIA</Button>
      </div>
    </div>
  );

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`DETALHES DO PEDIDO #${order.daily_number}`}>
      <div className="flex flex-col space-y-6 pb-10">
        
        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center space-x-3 animate-pulse">
            <AlertTriangle className="text-red-500 shrink-0" size={20} />
            <p className="text-red-700 text-sm font-bold">{errorMsg}</p>
          </div>
        )}

        {/* Header Info */}
        <div className="flex items-start justify-between bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-zinc-400 mb-1">
              <Clock size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <h3 className="font-black text-zinc-900 text-lg uppercase leading-none">
              {order.customer_name || "Cliente Final"}
            </h3>
            <p className="text-xs font-bold text-zinc-500">
              {order.order_type === 'BALCAO' ? <Utensils size={12} className="inline mr-1" /> : <ShoppingBag size={12} className="inline mr-1" />}
              {order.order_type} • {order.source}
            </p>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.payment_status} />
          </div>
        </div>

        {/* Items Section */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Itens do Pedido</h4>
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="divide-y divide-zinc-100 max-h-60 overflow-y-auto">
              {order.items?.map(item => (
                <div key={item.id} className="p-4">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-black text-sm text-zinc-900">{item.quantity}x {item.product?.name}</span>
                    <span className="font-black text-zinc-900 text-xs italic opacity-80">R$ {item.total_price.toFixed(2)}</span>
                  </div>
                  
                  {item.removed_ingredients && item.removed_ingredients.length > 0 && (
                    <p className="text-[10px] text-brand-red font-black uppercase mt-1">
                      - SEM: {item.removed_ingredients.map(ri => ri.ingredient?.name).join(', ')}
                    </p>
                  )}
                  {item.addons && item.addons.length > 0 && (
                    <p className="text-[10px] text-emerald-600 font-black uppercase mt-0.5">
                      + ADD: {item.addons.map(a => a.addon?.name).join(', ')}
                    </p>
                  )}
                  {item.notes && (
                    <div className="mt-2 bg-zinc-50 p-2 rounded-lg border-l-4 border-zinc-200">
                      <p className="text-[11px] text-zinc-500 font-bold italic leading-tight">&quot;{item.notes}&quot;</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-between items-center">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Geral</span>
              <span className="text-2xl font-black text-brand-red">
                <span className="text-sm mr-1">R$</span>
                {order.total_amount.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>
        </div>

        {/* Action Center */}
        <div className="space-y-3 pt-2">
          
          {/* Main Contextual Actions */}
          {!showPaymentSelection && !showCancelReason && (
            <div className="grid grid-cols-1 gap-3">
              
              {/* Ready to process actions */}
              {order.status === 'AGUARDANDO_CONFIRMACAO' && (
                <Button className="h-16 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg rounded-2xl shadow-lg shadow-emerald-200" onClick={onConfirm} disabled={isLoading}>
                  <CheckCircle2 className="mr-2" /> CONFIRMAR PEDIDO
                </Button>
              )}
              
              {order.status === 'NA_FILA' && (
                <Button className="h-16 bg-brand-amber hover:bg-brand-amber/90 text-brand-charcoal font-black text-lg rounded-2xl shadow-lg shadow-brand-amber/20" onClick={onReady} disabled={isLoading}>
                  <Package className="mr-2" /> MARCAR PRONTO
                </Button>
              )}
              
              {order.status === 'PRONTO' && (
                <Button className="h-16 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg rounded-2xl shadow-lg shadow-emerald-200" onClick={onDeliver} disabled={isLoading}>
                  <CheckCircle2 className="mr-2" /> ENTREGAR PEDIDO
                </Button>
              )}

              {/* Payment Alert & Action */}
              {order.payment_status === 'PENDING' && order.status !== 'CANCELADO' && (
                <div className="bg-brand-amber/5 border-2 border-brand-amber/30 p-4 rounded-2xl flex flex-col space-y-3">
                  <div className="flex items-center space-x-2 text-brand-amber">
                    <AlertTriangle size={18} />
                    <span className="text-xs font-black uppercase tracking-widest">Pagamento Pendente</span>
                  </div>
                  <Button className="bg-brand-amber text-brand-charcoal font-black hover:bg-brand-amber/80 h-12" onClick={() => setShowPaymentSelection(true)} disabled={isLoading}>
                    RECEBER AGORA
                  </Button>
                </div>
              )}

              {/* Add items to open order */}
              {order.payment_status === 'PENDING' && ['NA_FILA', 'AGUARDANDO_PAGAMENTO'].includes(order.status) && (
                <Button 
                  variant="outline" 
                  className="h-14 border-2 border-zinc-900 text-zinc-900 font-black rounded-2xl active:bg-zinc-900 active:text-white transition-all" 
                  onClick={() => router.push(`/app/novo-pedido?add_to=${order.id}`)}
                  disabled={isLoading}
                >
                  <PlusCircle className="mr-2" size={20} />
                  ADICIONAR À COMANDA
                </Button>
              )}

              {/* Secondary Actions Row */}
              <div className="grid grid-cols-2 gap-3">
                {['NA_FILA', 'PRONTO', 'ENTREGUE'].includes(order.status) && (
                  <Button variant="outline" className="h-14 border-2 font-black text-xs text-zinc-500" onClick={onReprint} disabled={isLoading}>
                    <Printer className="mr-2" size={16} /> REIMPRIMIR
                  </Button>
                )}
                
                {['AGUARDANDO_CONFIRMACAO', 'NA_FILA', 'PRONTO'].includes(order.status) && (
                  <Button variant="outline" className="h-14 border-2 font-black text-xs text-red-500 border-red-100 hover:bg-red-50" onClick={() => setShowCancelReason(true)} disabled={isLoading}>
                    <XCircle className="mr-2" size={16} /> CANCELAR
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Payment Selection Mode */}
          {showPaymentSelection && renderPaymentSelection()}

          {/* Cancellation Reason Mode */}
          {showCancelReason && (
            <div className="space-y-4 p-5 bg-red-50 border-2 border-red-100 rounded-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center space-x-2 text-red-600 mb-2">
                <XCircle size={20} />
                <h4 className="font-black text-sm uppercase tracking-widest">Cancelar Pedido</h4>
              </div>
              <input 
                type="text" 
                className="w-full p-4 bg-white border border-red-100 rounded-xl font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500" 
                placeholder="Qual o motivo?" 
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
              <div className="flex space-x-3 pt-2">
                <Button variant="destructive" className="flex-1 h-14 font-black rounded-xl shadow-lg shadow-red-200" onClick={onCancel} disabled={isLoading}>
                  CONFIRMAR
                </Button>
                <Button variant="outline" className="h-14 font-black rounded-xl border-2" onClick={() => setShowCancelReason(false)} disabled={isLoading}>
                  VOLTAR
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
