import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/features/cart/useCart";
import { pdvApi } from "@/lib/api/pdv-api";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

interface OrderSummarySheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OrderSummarySheet({ isOpen, onClose }: OrderSummarySheetProps) {
  const { 
    items, 
    orderType, 
    customerName, 
    customerPhone, 
    orderNotes, 
    setCustomerInfo, 
    setOrderNotes, 
    getEstimatedSubtotal,
    clearCart
  } = useCart();
  
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("PIX");
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<"AMOUNT" | "PERCENT">("AMOUNT");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [discountReason, setDiscountReason] = useState<string>("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ daily_number: number; total_amount: number } | null>(null);
  
  const estimatedSubtotal = getEstimatedSubtotal();
  
  const paymentMethods = [
    { value: "PIX", label: "PIX" },
    { value: "CASH", label: "Dinheiro" },
    { value: "DEBIT_CARD", label: "Cartão de Débito" },
    { value: "CREDIT_CARD", label: "Cartão de Crédito" },
    { value: "PENDING", label: "Pendente (Pagar depois)" },
    { value: "COURTESY", label: "Cortesia" },
  ];

  const handleCheckout = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Derive payment status
      let paymentStatus = "PAID";
      if (selectedPaymentMethod === "PENDING") paymentStatus = "PENDING";
      if (selectedPaymentMethod === "COURTESY") paymentStatus = "COURTESY";

      // Handle discount
      let finalDiscount = undefined;
      const numDiscountVal = parseFloat(discountValue.replace(",", "."));
      if (hasDiscount && numDiscountVal > 0 && discountReason.trim()) {
        finalDiscount = {
          type: discountType,
          value: numDiscountVal,
          reason: discountReason.trim()
        };
      }

      const payload = {
        order_type: orderType,
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        notes: orderNotes.trim() || undefined,
        payment_method: selectedPaymentMethod,
        payment_status: paymentStatus,
        discount: finalDiscount,
        items: items.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          removed_ingredient_ids: item.removed_ingredients, // exactly as in CartItem
          addons: item.addons.map(add => ({
            addon_id: add.addon_id,
            quantity: add.quantity
          })),
          notes: item.notes
        }))
      };

      const response = await pdvApi.createAttendantOrder(payload);
      
      if (response && response.success) {
        setSuccessData({
          daily_number: response.order.daily_number,
          total_amount: response.order.total_amount
        });
        clearCart();
      } else {
        throw new Error("Resposta inválida do servidor.");
      }

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erro desconhecido ao finalizar pedido.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (successData) {
      setSuccessData(null); // Reset for next time if they don't unmount
    }
    setError(null);
    onClose();
  };

  if (successData) {
    return (
      <BottomSheet isOpen={isOpen} onClose={handleClose} title="Pedido Finalizado!">
        <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-emerald-500" />
          <h2 className="text-2xl font-bold text-zinc-900">
            Pedido #{String(successData.daily_number).padStart(3, '0')}
          </h2>
          <p className="text-zinc-600">
            Status: <span className="font-semibold text-brand-amber">NA FILA</span>
          </p>
          <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl w-full my-4">
            <p className="text-sm">Total Oficial do Pedido</p>
            <p className="text-3xl font-black">
              R$ {successData.total_amount.toFixed(2).replace(".", ",")}
            </p>
          </div>
          
          <Button onClick={handleClose} className="w-full h-14 text-lg mt-4">
            Novo Pedido
          </Button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Resumo do Pedido">
      <div className="flex flex-col min-h-[50vh]">
        <div className="flex-1 flex flex-col space-y-6 pb-6 pt-4 px-4">
          
          {/* Resumo dos Itens */}
          <div className="space-y-3">
            <h3 className="font-semibold text-zinc-900 px-1">Itens ({items.length})</h3>
            <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm border-b border-zinc-100 pb-2 last:border-0 last:pb-0">
                  <div className="flex-1">
                    <p className="font-medium text-zinc-800">{item.quantity}x {item.product.name}</p>
                    
                    {item.removed_ingredients.length > 0 && (
                      <p className="text-xs text-red-500 mt-0.5">
                        - {item.removed_ingredients.length} ingrediente(s) removido(s)
                      </p>
                    )}
                    
                    {item.addons.length > 0 && (
                      <p className="text-xs text-emerald-600 mt-0.5">
                        + {item.addons.reduce((acc, add) => acc + add.quantity, 0)} adicional(is)
                      </p>
                    )}
                    
                    {item.notes && (
                      <p className="text-xs text-zinc-500 italic mt-0.5">Obs: {item.notes}</p>
                    )}
                  </div>
                </div>
              ))}
              
              <div className="pt-2 flex justify-between font-bold text-zinc-900 border-t border-zinc-200">
                <span>Subtotal Estimado</span>
                <span>R$ {estimatedSubtotal.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>
          </div>

          {/* Dados do Cliente (Opcional) */}
          <div className="space-y-3">
            <h3 className="font-semibold text-zinc-900 px-1">Cliente (Opcional)</h3>
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="Nome do cliente" 
                value={customerName}
                onChange={(e) => setCustomerInfo(e.target.value, customerPhone)}
                className="w-full p-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
              <input 
                type="tel" 
                placeholder="Telefone (WhatsApp)" 
                value={customerPhone}
                onChange={(e) => setCustomerInfo(customerName, e.target.value)}
                className="w-full p-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
              <textarea 
                placeholder="Observação geral do pedido" 
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full p-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red resize-none h-20"
              />
            </div>
          </div>

          {/* Desconto */}
          <div className="space-y-3">
            <button 
              onClick={() => setHasDiscount(!hasDiscount)}
              className="w-full flex items-center justify-between font-semibold text-zinc-900 px-1"
            >
              <span>Desconto</span>
              {hasDiscount ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            
            {hasDiscount && (
              <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
                <div className="flex space-x-2">
                  <select 
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as "AMOUNT" | "PERCENT")}
                    className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red"
                  >
                    <option value="AMOUNT">R$</option>
                    <option value="PERCENT">%</option>
                  </select>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="Valor" 
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="flex-1 p-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red"
                  />
                </div>
                <input 
                  type="text" 
                  placeholder="Motivo do desconto (Obrigatório)" 
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  className="w-full p-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>
            )}
          </div>

          {/* Forma de Pagamento */}
          <div className="space-y-3">
            <h3 className="font-semibold text-zinc-900 px-1">Pagamento</h3>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map(method => (
                <button
                  key={method.value}
                  onClick={() => setSelectedPaymentMethod(method.value)}
                  className={`p-3 text-sm font-medium rounded-xl border transition-colors ${
                    selectedPaymentMethod === method.value 
                      ? 'bg-brand-red text-white border-brand-red' 
                      : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm mt-4">
              {error}
            </div>
          )}

        </div>

        {/* Botão Sticky no Rodapé */}
        <div className="sticky bottom-0 left-0 right-0 p-4 bg-white border-t border-zinc-200 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] mt-auto">
          <Button 
            className="w-full h-14 text-lg bg-brand-red hover:bg-brand-red/90 text-white" 
            onClick={handleCheckout}
            disabled={isSubmitting || items.length === 0}
          >
            {isSubmitting ? "Criando pedido..." : "Finalizar pedido"}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
