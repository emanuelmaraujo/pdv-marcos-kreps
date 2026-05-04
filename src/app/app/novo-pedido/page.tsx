"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useCart } from "@/features/cart/useCart";
import { menuApi, MenuData } from "@/lib/api/menu-api";
import { Product, OrderType, Ingredient } from "@/types/pdv";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { OrderSummarySheet } from "@/components/checkout/OrderSummarySheet";
import { Minus, Plus, ShoppingBag, Utensils } from "lucide-react";

export default function NovoPedidoPage() {
  const { items, getEstimatedSubtotal, orderType, setOrderType, addItem } = useCart();
  
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  // Customization Sheet State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
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

  const filteredProducts = useMemo(() => {
    if (!menuData || !selectedCategoryId) return [];
    return menuData.products.filter(p => p.category_id === selectedCategoryId);
  }, [menuData, selectedCategoryId]);

  const openCustomization = (product: Product) => {
    setSelectedProduct(product);
    setRemovedIngredientIds(new Set());
    setSelectedAddons(new Map());
    setQuantity(1);
    setNotes("");
  };

  const closeCustomization = () => {
    setSelectedProduct(null);
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

    addItem({
      product: selectedProduct,
      quantity,
      removed_ingredients: Array.from(removedIngredientIds),
      addons: addonsArray,
      notes: notes.trim() ? notes : undefined
    });

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
    return <div className="flex-1 flex items-center justify-center h-full text-zinc-500">Carregando cardápio...</div>;
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center h-full text-red-500">{error}</div>;
  }

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      <OrderSummarySheet 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
      />

      {/* Header Compacto com Controle de Segmento */}
      <div className="bg-white border-b border-zinc-200 px-4 pt-4 pb-2 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Novo Pedido</h1>
        </div>
        <div className="flex bg-zinc-100 p-1 rounded-lg">
          <button 
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${orderType === 'BALCAO' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            onClick={() => handleOrderTypeToggle('BALCAO')}
          >
            <Utensils className="inline-block w-4 h-4 mr-2" />
            Balcão
          </button>
          <button 
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${orderType === 'VIAGEM' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            onClick={() => handleOrderTypeToggle('VIAGEM')}
          >
            <ShoppingBag className="inline-block w-4 h-4 mr-2" />
            Viagem
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pb-32">
        {/* Categorias (Chips Horizontais) */}
        <div className="bg-white pt-2 pb-3 px-4 border-b border-zinc-200">
          <div className="flex space-x-2 overflow-x-auto hide-scrollbar">
            {menuData?.categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategoryId(category.id)}
                className={`whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                  selectedCategoryId === category.id 
                    ? 'bg-zinc-900 text-white' 
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Produtos Grid */}
        <div className="p-4">
          {filteredProducts.length === 0 ? (
            <EmptyState 
              title="Nenhum produto" 
              description="Não há produtos disponíveis nesta categoria." 
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredProducts.map(product => (
                <div 
                  key={product.id} 
                  onClick={() => openCustomization(product)}
                  className="bg-white border border-zinc-200 p-4 rounded-xl shadow-sm active:border-orange-500 active:ring-1 active:ring-orange-500 transition-all flex justify-between items-center cursor-pointer"
                >
                  <div className="pr-4">
                    <h3 className="text-zinc-900 font-bold text-lg leading-tight">{product.name}</h3>
                    {product.description && (
                      <p className="text-zinc-500 text-sm mt-1 line-clamp-2">{product.description}</p>
                    )}
                    <p className="text-orange-600 font-bold mt-2">R$ {product.price.toFixed(2)}</p>
                  </div>
                  <div className="bg-zinc-100 text-zinc-600 p-2 rounded-full h-10 w-10 flex items-center justify-center shrink-0">
                    <Plus size={20} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Preview (Fixed Bottom) */}
      <div className="absolute bottom-[64px] left-0 right-0 p-4 bg-white border-t border-zinc-200 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-10">
        <div className="flex justify-between items-center mb-3">
          <span className="text-zinc-600 font-medium">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
          <div className="text-right">
            <span className="text-xs text-zinc-500 block">Subtotal estimado</span>
            <span className="text-zinc-900 font-bold text-xl leading-none">R$ {getEstimatedSubtotal().toFixed(2)}</span>
          </div>
        </div>
        <Button 
          className="w-full h-14 text-lg font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-xl" 
          disabled={items.length === 0}
          onClick={() => setIsCheckoutOpen(true)}
        >
          {items.length === 0 ? 'Carrinho Vazio' : 'Continuar'}
        </Button>
      </div>

      {/* Product Customization Bottom Sheet */}
      <BottomSheet 
        isOpen={!!selectedProduct} 
        onClose={closeCustomization}
        title="Personalizar Item"
      >
        {selectedProduct && (
          <div className="p-6 pt-2 flex flex-col space-y-6">
            
            {/* Header / Basic Info */}
            <div>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">{selectedProduct.name}</h3>
              <p className="text-xl font-bold text-orange-600 mt-1">R$ {selectedProduct.price.toFixed(2)}</p>
            </div>

            {/* Ingredients Selection */}
            {productDefaultIngredients.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Ingredientes Padrão</h4>
                <div className="space-y-2">
                  {productDefaultIngredients.map(ing => (
                    <label key={ing.id} className="flex items-center space-x-3 p-3 bg-zinc-50 rounded-lg border border-zinc-200 cursor-pointer active:bg-zinc-100">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-zinc-300 text-orange-500 focus:ring-orange-500 accent-orange-500"
                        checked={!removedIngredientIds.has(ing.id)}
                        onChange={() => toggleIngredient(ing.id)}
                      />
                      <span className={`text-base font-medium ${removedIngredientIds.has(ing.id) ? 'text-zinc-400 line-through' : 'text-zinc-800'}`}>
                        {ing.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Addons Selection */}
            {menuData && menuData.addons.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Adicionais</h4>
                <div className="space-y-2">
                  {menuData.addons.map(addon => {
                    const qty = selectedAddons.get(addon.id) || 0;
                    return (
                      <div key={addon.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                        <div>
                          <span className="text-base font-medium text-zinc-800 block">{addon.name}</span>
                          <span className="text-sm text-orange-600 font-bold">+ R$ {addon.price.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center space-x-3 bg-white border border-zinc-200 rounded-full p-1">
                          <button 
                            onClick={() => updateAddonQty(addon.id, -1)}
                            className={`p-2 rounded-full transition-colors ${qty > 0 ? 'text-zinc-700 bg-zinc-100 hover:bg-zinc-200' : 'text-zinc-300'}`}
                            disabled={qty === 0}
                          >
                            <Minus size={16} strokeWidth={3} />
                          </button>
                          <span className="w-4 text-center font-bold text-zinc-900">{qty}</span>
                          <button 
                            onClick={() => updateAddonQty(addon.id, 1)}
                            className="p-2 rounded-full text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                          >
                            <Plus size={16} strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Observações</h4>
              <textarea 
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 resize-none"
                rows={2}
                placeholder="Ex: Ponto da carne, sem sal..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Quantity & Add to Cart */}
            <div className="pt-4 border-t border-zinc-200 flex items-center space-x-4">
              {/* Main Item Quantity Control */}
              <div className="flex items-center space-x-3 bg-zinc-100 rounded-full p-1 border border-zinc-200 h-14">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-3 rounded-full text-zinc-700 bg-white shadow-sm disabled:opacity-50"
                  disabled={quantity <= 1}
                >
                  <Minus size={20} strokeWidth={3} />
                </button>
                <span className="w-6 text-center font-bold text-xl text-zinc-900">{quantity}</span>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-3 rounded-full text-zinc-700 bg-white shadow-sm"
                >
                  <Plus size={20} strokeWidth={3} />
                </button>
              </div>

              <Button 
                onClick={handleAddToCart}
                className="flex-1 h-14 text-lg font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-md"
              >
                <div className="flex flex-col items-center leading-none space-y-1">
                  <span>Adicionar</span>
                  <span className="text-xs font-semibold opacity-90">R$ {sheetSubtotal.toFixed(2)}</span>
                </div>
              </Button>
            </div>
            
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
