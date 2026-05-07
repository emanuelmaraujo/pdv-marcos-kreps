import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/features/cart/useCart";
import { pdvApi } from "@/lib/api/pdv-api";
import { CheckCircle2, ChevronDown, ChevronUp, Edit2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface OrderSummarySheetProps {
  isOpen: boolean;
  onClose: () => void;
  onEditItem?: (item: import("@/features/cart/useCart").CartItem) => void;
}

export function OrderSummarySheet({ isOpen, onClose, onEditItem }: OrderSummarySheetProps) {
  const {
    items,
    customerName,
    customerPhone,
    orderType,
    setCustomerInfo,
    orderNotes,
    setOrderNotes,
    getEstimatedSubtotal,
    removeItem,
    clearCart,
    targetOrderId
  } = useCart();

  const router = useRouter();

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
          removed_ingredient_ids: item.removed_ingredients,
          addons: item.addons.map(add => ({
            addon_id: add.addon_id,
            quantity: add.quantity
          })),
          notes: item.notes
        }))
      };

      if (targetOrderId) {
        const addPayload = {
          order_id: targetOrderId,
          items: items.map(item => ({
            product_id: item.product.id,
            quantity: item.quantity,
            removed_ingredient_ids: item.removed_ingredients,
            addons: item.addons.map(add => ({
              addon_id: add.addon_id,
              quantity: add.quantity
            })),
            notes: item.notes
          }))
        };
        
        const response = await pdvApi.addItemsToOrder(addPayload);
        if (response && response.success) {
          alert("Itens adicionados com sucesso!");
          clearCart();
          router.push("/app/pedidos");
        }
        return;
      }

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
      setSuccessData(null);
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
        <div className="flex-1 flex flex-col space-y-8 pb-10 pt-4 px-4">
          
          <button 
            onClick={onClose}
            className="flex items-center text-zinc-500 font-black text-[10px] uppercase tracking-widest hover:text-zinc-700 transition-colors"
          >
            <ChevronDown size={16} className="mr-1" />
            Voltar para as opções
          </button>
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest">Itens no Carrinho</h3>
              <span className="bg-zinc-100 text-zinc-600 text-[10px] font-black px-2 py-1 rounded-md">
                {items.length} {items.length === 1 ? 'ITEM' : 'ITENS'}
              </span>
            </div>
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="divide-y divide-zinc-100">
                {items.map((item) => (
                  <div key={item.id} className="p-4 flex flex-col space-y-2 group active:bg-zinc-50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-extrabold text-zinc-900 leading-tight text-[13px]">
                          {item.quantity}x {item.product.name}
                        </p>
                        
                        {item.removed_ingredients.length > 0 && (
                          <p className="text-[11px] text-brand-red font-bold uppercase mt-1">
                            REMOVER: {item.removed_ingredients.join(", ")}
                          </p>
                        )}
                        
                        {item.addons.length > 0 && (
                          <p className="text-[11px] text-emerald-600 font-bold uppercase mt-0.5">
                            ADICIONAIS: {item.addons.map(a => `${a.quantity}x ${a.addon_id.split('-').pop()}`).join(", ")}
                          </p>
                        )}
                        
                        {item.notes && (
                          <div className="bg-zinc-50 border-l-4 border-zinc-200 p-2 mt-2 rounded-r-lg">
                            <p className="text-[11px] text-zinc-500 italic font-medium">&quot;{item.notes}&quot;</p>
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button 
                          onClick={() => onEditItem?.(item)}
                          className="p-3 bg-zinc-100 text-zinc-500 rounded-xl active:bg-brand-charcoal active:text-white transition-all border border-zinc-200"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="p-3 bg-red-50 text-red-500 rounded-xl active:bg-brand-red active:text-white transition-all border border-red-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="p-5 bg-zinc-50 border-t border-zinc-100 flex justify-between items-center">
                <span className="font-bold text-zinc-400 text-xs uppercase tracking-widest">Subtotal Estimado</span>
                <span className="text-2xl font-black text-brand-red">
                  <span className="text-sm mr-1">R$</span>
                  {estimatedSubtotal.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>
          </div>

          {!targetOrderId && (
            <>
              {/* Identificação do Cliente */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest px-1">Identificação</h3>
                <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-5 shadow-sm">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Nome do Cliente</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Marcos Silva" 
                      value={customerName}
                      onChange={(e) => setCustomerInfo(e.target.value, customerPhone)}
                      className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red focus:bg-white transition-all font-bold text-zinc-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">WhatsApp</label>
                    <input 
                      type="tel" 
                      placeholder="(00) 00000-0000" 
                      value={customerPhone}
                      onChange={(e) => setCustomerInfo(customerName, e.target.value)}
                      className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red focus:bg-white transition-all font-bold text-zinc-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Observações Gerais</label>
                    <textarea 
                      placeholder="Algum detalhe importante para a produção?" 
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red focus:bg-white transition-all font-bold text-zinc-900 resize-none h-24"
                    />
                  </div>
                </div>
              </div>

              {/* Desconto Especial */}
              <div className="space-y-4">
                <button 
                  onClick={() => setHasDiscount(!hasDiscount)}
                  className="w-full flex items-center justify-between px-1"
                >
                  <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest">Desconto Especial</h3>
                  {hasDiscount ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                </button>
                
                {hasDiscount && (
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="flex space-x-3">
                      <select 
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as "AMOUNT" | "PERCENT")}
                        className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red font-black text-zinc-700"
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
                        className="flex-1 p-4 bg-zinc-50 border border-zinc-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red font-black text-zinc-900"
                      />
                    </div>
                    <input 
                      type="text" 
                      placeholder="Motivo (Obrigatório para desconto)" 
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red font-bold text-zinc-900"
                    />
                  </div>
                )}
              </div>

              {/* Forma de Pagamento */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest px-1">Forma de Pagamento</h3>
                <div className="grid grid-cols-2 gap-3">
                  {paymentMethods.map(method => (
                    <button
                      key={method.value}
                      onClick={() => setSelectedPaymentMethod(method.value)}
                      className={`p-4 text-xs font-black rounded-2xl border-2 transition-all uppercase tracking-widest ${
                        selectedPaymentMethod === method.value 
                          ? 'bg-brand-red/5 text-brand-red border-brand-red shadow-sm' 
                          : 'bg-white text-zinc-400 border-zinc-100 hover:border-zinc-200'
                      }`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-bold animate-pulse">
              ⚠️ {error}
            </div>
          )}

        </div>

        {/* Botão de Ação Sticky */}
        <div className="sticky bottom-0 left-0 right-0 p-4 bg-white border-t border-zinc-200 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-5px_rgba(0,0,0,0.05)] mt-auto">
          <Button 
            className="w-full h-14 text-lg font-black bg-brand-red hover:bg-brand-red/90 text-white shadow-lg shadow-brand-red/20 rounded-xl active:scale-[0.98] transition-transform" 
            onClick={handleCheckout}
            disabled={isSubmitting || items.length === 0}
          >
            {isSubmitting ? (targetOrderId ? "ADICIONANDO..." : "PROCESSANDO...") : (targetOrderId ? "CONFIRMAR ADIÇÃO" : "FINALIZAR PEDIDO")}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
