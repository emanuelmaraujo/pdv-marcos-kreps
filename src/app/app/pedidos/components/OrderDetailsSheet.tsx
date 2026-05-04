import { Order, PaymentMethod, PaymentStatus } from "@/types/pdv";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { useState } from "react";
import { pdvApi } from "@/lib/api/pdv-api";

interface Props {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: () => void;
}

export function OrderDetailsSheet({ order, isOpen, onClose, onOrderUpdated }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);

  if (!order) return null;

  const handleAction = async (action: () => Promise<unknown>, successMsg: string) => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      await action();
      alert(successMsg); // Temp fallback, toast would be better
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

  const onConfirm = () => handleAction(() => pdvApi.confirmOrder(order.id), "Pedido confirmado!");
  const onReady = () => handleAction(() => pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "PRONTO" }), "Pedido marcado como pronto!");
  const onDeliver = () => {
    if (order.payment_status === "PENDING") {
      const confirm = window.confirm("Atenção: O pagamento está PENDENTE. Deseja entregar mesmo assim?");
      if (!confirm) return;
    }
    handleAction(() => pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "ENTREGUE" }), "Pedido entregue!");
  };
  
  const onCancel = () => {
    if (!cancelReason.trim()) {
      setErrorMsg("Motivo de cancelamento obrigatório.");
      return;
    }
    handleAction(() => pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "CANCELADO", reason: cancelReason }), "Pedido cancelado.");
  };

  const onMarkPayment = (method: PaymentMethod, pStatus: PaymentStatus) => {
    handleAction(() => pdvApi.markPayment({ orderId: order.id, paymentMethod: method, status: pStatus }), "Pagamento atualizado!");
  };

  const onReprint = () => {
    handleAction(() => pdvApi.reprintOrder({ orderId: order.id, copies: ['CUSTOMER', 'KITCHEN', 'JUICE_POTATO'] }), "Reimpressão solicitada!");
  };

  const renderPaymentSelection = () => (
    <div className="mt-4 space-y-2 border border-border p-4 rounded-md">
      <h4 className="font-bold mb-2">Selecione o Pagamento</h4>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => onMarkPayment('PIX', 'PAID')} disabled={isLoading}>Pix</Button>
        <Button variant="outline" size="sm" onClick={() => onMarkPayment('DEBIT_CARD', 'PAID')} disabled={isLoading}>Débito</Button>
        <Button variant="outline" size="sm" onClick={() => onMarkPayment('CREDIT_CARD', 'PAID')} disabled={isLoading}>Crédito</Button>
        <Button variant="outline" size="sm" onClick={() => onMarkPayment('CASH', 'PAID')} disabled={isLoading}>Dinheiro</Button>
        <Button variant="outline" size="sm" onClick={() => onMarkPayment('COURTESY', 'COURTESY')} disabled={isLoading}>Cortesia</Button>
      </div>
      <Button variant="ghost" className="w-full mt-2" onClick={() => setShowPaymentSelection(false)} disabled={isLoading}>Voltar</Button>
    </div>
  );

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`Pedido #${order.daily_number}`}>
      <div className="space-y-4 pb-8">
        {errorMsg && <div className="text-red-500 text-sm font-bold bg-red-50 p-2 rounded">{errorMsg}</div>}
        
        <div className="flex justify-between items-center">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.payment_status} />
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Origem: {order.source} • {order.order_type}</p>
          {order.customer_name && <p className="font-medium">Cliente: {order.customer_name} {order.customer_phone}</p>}
        </div>

        <div className="border-t border-b border-border py-4 space-y-3 max-h-64 overflow-y-auto">
          <h4 className="font-bold">Itens do Pedido</h4>
          {order.items?.map(item => (
            <div key={item.id} className="text-sm">
              <div className="flex justify-between font-medium">
                <span>{item.quantity}x {item.product?.name}</span>
                <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total_price)}</span>
              </div>
              {item.removed_ingredients && item.removed_ingredients.length > 0 && (
                <div className="text-red-500 text-xs ml-4">- Sem {item.removed_ingredients.map(ri => ri.ingredient?.name).join(', ')}</div>
              )}
              {item.addons && item.addons.length > 0 && (
                <div className="text-green-600 text-xs ml-4">+ {item.addons.map(a => a.addon?.name).join(', ')}</div>
              )}
              {item.notes && <div className="text-muted-foreground text-xs ml-4 italic">Obs: {item.notes}</div>}
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center font-bold text-lg">
          <span>Total</span>
          <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}</span>
        </div>
        
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Criado em: {new Date(order.created_at).toLocaleTimeString()}</p>
        </div>

        {/* ACTIONS */}
        <div className="pt-4 space-y-2">
           {order.payment_status === 'PENDING' && !showPaymentSelection && order.status !== 'CANCELADO' && (
             <Button variant="default" className="w-full bg-amber-500 hover:bg-amber-600 text-white border-transparent" onClick={() => setShowPaymentSelection(true)} disabled={isLoading}>
               Marcar Pagamento
             </Button>
           )}
           {showPaymentSelection && renderPaymentSelection()}

           {showCancelReason ? (
             <div className="space-y-2 p-3 border border-red-200 bg-red-50 rounded-md">
                <p className="text-sm font-bold text-red-600">Motivo do cancelamento:</p>
                <input 
                  type="text" 
                  className="w-full p-2 border rounded text-sm" 
                  placeholder="Ex: Cliente desistiu" 
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
                <div className="flex space-x-2">
                  <Button variant="destructive" className="flex-1" onClick={onCancel} disabled={isLoading}>Confirmar Cancelamento</Button>
                  <Button variant="outline" onClick={() => setShowCancelReason(false)} disabled={isLoading}>Voltar</Button>
                </div>
             </div>
           ) : (
             <>
                {order.status === 'AGUARDANDO_CONFIRMACAO' && (
                  <Button className="w-full bg-green-500 hover:bg-green-600" onClick={onConfirm} disabled={isLoading}>Confirmar Pedido</Button>
                )}
                {order.status === 'NA_FILA' && (
                  <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white border-transparent" onClick={onReady} disabled={isLoading}>Marcar como Pronto</Button>
                )}
                {order.status === 'PRONTO' && (
                  <Button className="w-full bg-green-500 hover:bg-green-600" onClick={onDeliver} disabled={isLoading}>Entregar Pedido</Button>
                )}

                {['NA_FILA', 'PRONTO', 'ENTREGUE'].includes(order.status) && (
                  <Button variant="outline" className="w-full" onClick={onReprint} disabled={isLoading}>Reimprimir Vias</Button>
                )}

                {['AGUARDANDO_CONFIRMACAO', 'NA_FILA', 'PRONTO'].includes(order.status) && (
                  <Button variant="ghost" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setShowCancelReason(true)} disabled={isLoading}>Cancelar Pedido</Button>
                )}
             </>
           )}
        </div>
      </div>
    </BottomSheet>
  );
}
