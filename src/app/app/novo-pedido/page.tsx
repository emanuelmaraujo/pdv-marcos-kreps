"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";

import { useCart } from "@/features/cart/useCart";
import { menuApi, MenuData } from "@/lib/api/menu-api";
import { pdvApi } from "@/lib/api/pdv-api";
import { Product, OrderType, Ingredient, Order } from "@/types/pdv";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { OrderSummarySheet } from "@/components/checkout/OrderSummarySheet";
import { Minus, Plus, ShoppingBag, Utensils, ShoppingCart, Info, AlertCircle, RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function NovoPedidoPage() {
  const searchParams = useSearchParams();
  const addToId = searchParams.get("add_to");
  
  const { 
    items, 
    getEstimatedSubtotal, 
    orderType, 
    setOrderType, 
    addItem, 
    updateItem,
    setTargetOrderId, 
    targetOrderId, 
    clearCart 
  } = useCart();
  
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [targetOrder, setTargetOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  // Customization Sheet State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [removedIngredientIds, setRemovedIngredientIds] = useState<Set<string>>(new Set());
  const [selectedAddons, setSelectedAddons] = useState<Map<string, number>>(new Map()); // AddonID -> quantity
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  useEffect(() => {
    async function loadMenu() {
      try {
        setLoading(true);
        const data = await menuApi.getMenuData();
        setMenuData(data);
        if (data.categories.length > 0) {
          setSelectedCategoryId(data.categories[0].id);
        }
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Erro ao carregar cardápio");
        }
      } finally {
        setLoading(false);
      }
    }
    loadMenu();
  }, []);

  useEffect(() => {
    if (addToId) {
      clearCart();
      setTargetOrderId(addToId);
      
      pdvApi.getOrder(addToId)
        .then(order => {
          const isAllowed = ['NA_FILA', 'AGUARDANDO_PAGAMENTO'].includes(order.status) && order.payment_status === 'PENDING';
          if (!isAllowed) {
            setError("Este pedido não está aberto para adições.");
          } else {
            setTargetOrder(order);
          }
        })
        .catch(() => setError("Erro ao carregar dados do pedido alvo."));
    }

    return () => {
      setTargetOrderId(null);
    };
  }, [addToId, clearCart, setTargetOrderId]);

  const filteredProducts = useMemo(() => {
    if (!menuData || !selectedCategoryId) return [];
    return menuData.products.filter(p => p.category_id === selectedCategoryId);
  }, [menuData, selectedCategoryId]);

  const openCustomization = (product: Product, existingItem?: import("@/features/cart/useCart").CartItem) => {
    setSelectedProduct(product);
    if (existingItem) {
      setEditingCartItemId(existingItem.id);
      setRemovedIngredientIds(new Set(existingItem.removed_ingredients));
      const addonsMap = new Map();
      existingItem.addons.forEach((a: { addon_id: string; quantity: number }) => addonsMap.set(a.addon_id, a.quantity));
      setSelectedAddons(addonsMap);
      setQuantity(existingItem.quantity);
      setNotes(existingItem.notes || "");
    } else {
      setEditingCartItemId(null);
      setRemovedIngredientIds(new Set());
      setSelectedAddons(new Map());
      setQuantity(1);
      setNotes("");
    }
  };

  const closeCustomization = () => {
    setSelectedProduct(null);
    setEditingCartItemId(null);
  };

  const toggleIngredient = (ingredientId: string) => {
    setRemovedIngredientIds(prev => {
      const next = new Set(prev);
      if (next.has(ingredientId)) next.delete(ingredientId);
      else next.add(ingredientId);
      return next;
    });
  };

  const updateAddonQty = (addonId: string, delta: number) => {
    setSelectedAddons(prev => {
      const next = new Map(prev);
      const current = next.get(addonId) || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) next.delete(addonId);
      else next.set(addonId, newQty);
      return next;
    });
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    // Convert Set and Map to array format expected by CartItem
    const addonsArray = Array.from(selectedAddons.entries()).map(([addonId, qty]) => {
      const addonData = menuData?.addons.find(a => a.id === addonId);
      return { addon_id: addonId, quantity: qty, price: addonData?.price || 0 };
    });

    const itemData = {
      product: selectedProduct,
      quantity,
      removed_ingredients: Array.from(removedIngredientIds),
      addons: addonsArray,
      notes: notes.trim() ? notes : undefined
    };

    if (editingCartItemId) {
      updateItem(editingCartItemId, itemData);
    } else {
      addItem(itemData);
    }

    closeCustomization();
  };

  const handleOrderTypeToggle = (type: OrderType) => {
    setOrderType(type);
  };

  // Derived state for the customization sheet
  const productDefaultIngredients = useMemo(() => {
    if (!selectedProduct || !menuData) return [];
    const rels = menuData.productIngredients.filter(pi => pi.product_id === selectedProduct.id);
    return rels.map(rel => menuData.ingredients.find(i => i.id === rel.ingredient_id)).filter(Boolean) as Ingredient[];
  }, [selectedProduct, menuData]);

  const sheetSubtotal = useMemo(() => {
    if (!selectedProduct) return 0;
    let total = selectedProduct.price;
    selectedAddons.forEach((qty, addonId) => {
      const addon = menuData?.addons.find(a => a.id === addonId);
      if (addon) total += (addon.price * qty);
    });
    return total * quantity;
  }, [selectedProduct, selectedAddons, quantity, menuData]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#F4F4F5] space-y-4">
        <RefreshCw className="animate-spin text-brand-red w-8 h-8" />
        <p className="text-zinc-400 font-black text-xs uppercase tracking-widest">Sincronizando Cardápio...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#F4F4F5] p-6 text-center">
        <AlertCircle className="text-red-500 w-12 h-12 mb-4" />
        <h2 className="text-lg font-black text-zinc-900 uppercase tracking-tight mb-2">Ops! Algo deu errado</h2>
        <p className="text-zinc-500 text-sm font-medium mb-6">{error}</p>
        <Button onClick={() => window.location.reload()} className="h-12 px-8 rounded-xl bg-zinc-900">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F8F9FA]">
        <OrderSummarySheet 
          isOpen={isCheckoutOpen} 
          onClose={() => setIsCheckoutOpen(false)} 
          onEditItem={(item: import("@/features/cart/useCart").CartItem) => {
            setIsCheckoutOpen(false);
            openCustomization(item.product, item);
          }}
        />

      {/* Sticky Header Container */}
      {!isCheckoutOpen && !selectedProduct && (
        <div className="sticky top-0 z-40 bg-white border-b border-zinc-200 animate-in fade-in duration-300">
          {/* Main Title & Context */}
          <div className="px-4 pt-6 pb-2">
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-6 bg-brand-red rounded-full" />
              <h1 className="text-xl font-black text-zinc-900 tracking-tight uppercase">
                {targetOrderId ? "Adicionar Itens" : "Novo Pedido"}
              </h1>
            </div>
            <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mt-0.5 ml-3.5">
              {targetOrder 
                ? `Pedido #${String(targetOrder.daily_number).padStart(3, '0')}`
                : "Marcos Krep's Operational"}
            </p>
          </div>

          {/* Order Type Toggle */}
          <div className="px-4 pb-4">
            <div className="flex bg-zinc-100 p-1 rounded-xl">
              <button 
                className={`flex-1 py-2.5 text-[11px] font-black rounded-lg transition-all duration-200 tracking-wider uppercase flex items-center justify-center ${orderType === 'BALCAO' ? 'bg-white text-brand-red shadow-sm' : 'text-zinc-500 hover:text-zinc-600'}`}
                onClick={() => handleOrderTypeToggle('BALCAO')}
              >
                <Utensils className="w-3.5 h-3.5 mr-2" />
                BALCÃO
              </button>
              <button 
                className={`flex-1 py-2.5 text-[11px] font-black rounded-lg transition-all duration-200 tracking-wider uppercase flex items-center justify-center ${orderType === 'VIAGEM' ? 'bg-white text-brand-red shadow-sm' : 'text-zinc-500 hover:text-zinc-600'}`}
                onClick={() => handleOrderTypeToggle('VIAGEM')}
              >
                <ShoppingBag className="w-3.5 h-3.5 mr-2" />
                VIAGEM
              </button>
            </div>
          </div>

          {/* Categorias - Now part of the same sticky container */}
          <div className="px-4 pb-3 border-t border-zinc-50 pt-3">
            <div className="flex space-x-2 overflow-x-auto hide-scrollbar">
              {menuData?.categories.map(category => {
                const isSelected = selectedCategoryId === category.id;
                const isDoces = category.name.toLowerCase().includes('doce');
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategoryId(category.id)}
                    className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center ${
                      isSelected 
                        ? 'bg-brand-red text-white shadow-md shadow-brand-red/20' 
                        : 'bg-white border border-zinc-200 text-zinc-500 hover:border-zinc-300 active:bg-zinc-50'
                    }`}
                  >
                    {isDoces ? "🍩 " : "🍕 "}
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto pb-64">
        {/* Produtos Grid - Improved Cards */}
        <div className="p-4">
          {filteredProducts.length === 0 ? (
            <div className="py-20 text-center">
              <div className="bg-zinc-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Info className="w-8 h-8 text-zinc-300" />
              </div>
              <p className="text-zinc-400 font-black text-[10px] uppercase tracking-[0.2em]">Sem produtos disponíveis</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredProducts.map(product => (
                <div 
                  key={product.id} 
                  onClick={() => openCustomization(product)}
                  className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-sm active:scale-[0.98] transition-all flex items-center space-x-4 cursor-pointer relative group"
                >
                  {/* Thumbnail Placeholder / Icon */}
                  <div className="w-16 h-16 bg-zinc-50 rounded-xl flex items-center justify-center shrink-0 border border-zinc-100 text-zinc-300">
                    <Utensils className="w-8 h-8 opacity-20" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="text-zinc-900 font-black text-sm uppercase leading-tight truncate mr-2">{product.name}</h3>
                      <div className="text-right shrink-0">
                        <p className="text-brand-red font-black text-base leading-none">
                          <span className="text-[10px] mr-0.5 opacity-50">R$</span>
                          {product.price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    {product.description && (
                      <p className="text-zinc-400 text-[9px] mt-1 line-clamp-1 font-bold uppercase tracking-wide">{product.description}</p>
                    )}
                    <div className="flex items-center mt-2.5">
                      <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border border-emerald-100/50">
                        Disponível
                      </span>
                    </div>
                  </div>

                  <div className="bg-brand-red text-white p-2.5 rounded-xl shadow-lg shadow-brand-red/10 group-active:bg-brand-red/80 transition-colors">
                    <Plus size={18} strokeWidth={4} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Cart - Fixed bottom offset for Nav Bar */}
      {items.length > 0 && !isCheckoutOpen && !selectedProduct && (
        <div className="fixed bottom-24 left-4 right-4 z-[60] animate-in slide-in-from-bottom-8">
          <button
            onClick={() => setIsCheckoutOpen(true)}
            className="w-full bg-brand-charcoal text-white rounded-2xl p-1 shadow-2xl shadow-black/40 flex items-center active:scale-[0.98] transition-all group"
          >
            <div className="bg-brand-red p-3.5 rounded-xl flex items-center justify-center min-w-[60px] shadow-lg shadow-brand-red/20">
              <ShoppingCart size={22} className="text-white" />
              <span className="absolute -top-1 -right-1 bg-brand-amber text-brand-charcoal text-[9px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-brand-charcoal">
                {items.length}
              </span>
            </div>
            <div className="flex-1 px-4 text-left">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">Ver Carrinho</p>
              <div className="flex items-baseline space-x-1">
                <span className="text-[10px] font-bold text-zinc-500">R$</span>
                <p className="font-black text-xl leading-none">{getEstimatedSubtotal().toFixed(2).replace('.', ',')}</p>
              </div>
            </div>
            <div className="pr-4">
              <div className="bg-white/10 p-1.5 rounded-full">
                <Plus size={16} className="text-white" strokeWidth={3} />
              </div>
            </div>
          </button>
        </div>
      )}


      {/* Product Customization Bottom Sheet */}
      <BottomSheet 
        isOpen={!!selectedProduct} 
        onClose={closeCustomization}
        title={editingCartItemId ? "EDITAR ITEM" : "PERSONALIZAR ITEM"}
      >
        {selectedProduct && (
          <div className="p-6 pt-2 flex flex-col space-y-8 pb-10">
            
            {/* Header / Basic Info */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">{selectedProduct.name}</h3>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="bg-zinc-100 text-zinc-500 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Base</span>
                  <p className="text-xl font-black text-brand-red">R$ {selectedProduct.price.toFixed(2)}</p>
                </div>
              </div>
              {editingCartItemId && (
                <span className="bg-brand-charcoal text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
                  Editando
                </span>
              )}
            </div>

            {/* Ingredients Selection */}
            {productDefaultIngredients.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-1">Ingredientes Padrão</h4>
                <div className="grid grid-cols-1 gap-3">
                  {productDefaultIngredients.map(ing => (
                    <label key={ing.id} className="flex items-center space-x-4 p-4 bg-white rounded-2xl border-2 border-zinc-100 cursor-pointer active:bg-zinc-50 transition-all select-none">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          className="peer w-6 h-6 rounded-lg border-2 border-zinc-200 text-brand-red focus:ring-brand-red accent-brand-red"
                          checked={!removedIngredientIds.has(ing.id)}
                          onChange={() => toggleIngredient(ing.id)}
                        />
                      </div>
                      <span className={`text-base font-black uppercase tracking-tight transition-all ${removedIngredientIds.has(ing.id) ? 'text-zinc-300 line-through' : 'text-zinc-800'}`}>
                        {ing.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Addons Selection */}
            {menuData && menuData.addons.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-1">Adicionais Extras</h4>
                <div className="space-y-3">
                  {menuData.addons.map(addon => {
                    const qty = selectedAddons.get(addon.id) || 0;
                    return (
                      <div key={addon.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border-2 border-zinc-100 group active:border-zinc-200 transition-all">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-zinc-800 uppercase tracking-tight">{addon.name}</span>
                          <span className="text-[11px] text-brand-red font-black">+ R$ {addon.price.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center space-x-4 bg-zinc-50 border border-zinc-100 rounded-2xl p-1.5">
                          <button 
                            onClick={() => updateAddonQty(addon.id, -1)}
                            className={`p-2.5 rounded-xl transition-all ${qty > 0 ? 'bg-white text-brand-charcoal shadow-sm active:scale-90' : 'text-zinc-300'}`}
                            disabled={qty === 0}
                          >
                            <Minus size={18} strokeWidth={4} />
                          </button>
                          <span className="w-5 text-center font-black text-zinc-900 text-lg">{qty}</span>
                          <button 
                            onClick={() => updateAddonQty(addon.id, 1)}
                            className="p-2.5 bg-white text-brand-red shadow-sm rounded-xl active:scale-90 transition-all"
                          >
                            <Plus size={18} strokeWidth={4} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-1">Observações Operacionais</h4>
              <textarea 
                className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl p-4 text-zinc-900 font-bold placeholder:text-zinc-300 focus:border-brand-red focus:ring-0 focus:bg-white transition-all resize-none h-24"
                placeholder="Ex: Sem sal, carne bem passada, etc..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Quantity & Add to Cart - Sticky at Bottom */}
            <div className="sticky bottom-0 left-0 right-0 pt-4 pb-6 bg-white border-t border-zinc-100 flex items-center space-x-4 mt-auto z-10">
              {/* Main Item Quantity Control */}
              <div className="flex items-center space-x-3 bg-zinc-100 rounded-xl p-1 border border-zinc-200 h-14">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2.5 rounded-lg text-zinc-400 bg-white shadow-sm disabled:opacity-30 active:scale-90 transition-all"
                  disabled={quantity <= 1}
                >
                  <Minus size={18} strokeWidth={4} />
                </button>
                <span className="w-6 text-center font-black text-xl text-zinc-900">{quantity}</span>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-2.5 rounded-lg text-brand-red bg-white shadow-sm active:scale-90 transition-all"
                >
                  <Plus size={18} strokeWidth={4} />
                </button>
              </div>

              <Button 
                onClick={handleAddToCart}
                className={`flex-1 h-14 text-base font-black rounded-xl shadow-lg transition-all active:scale-[0.98] ${editingCartItemId ? 'bg-brand-charcoal shadow-black/10' : 'bg-brand-red shadow-brand-red/20'}`}
              >
                <div className="flex flex-col items-center leading-none space-y-0.5">
                  <span className="uppercase tracking-widest text-xs">{editingCartItemId ? 'SALVAR' : 'ADICIONAR'}</span>
                  <span className="text-[10px] font-black opacity-80">R$ {sheetSubtotal.toFixed(2).replace('.', ',')}</span>
                </div>
              </Button>
            </div>
            
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
