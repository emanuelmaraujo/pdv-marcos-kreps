import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Product, OrderType, OrderSource } from '@/types/pdv';

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  removed_ingredients: string[];
  addons: { addon_id: string; addon_name?: string; quantity: number; price: number }[];
  notes?: string;
  is_takeout?: boolean;
}

interface CartState {
  items: CartItem[];
  orderType: OrderType;
  customerName: string;
  customerPhone: string;
  orderNotes: string;
  source: OrderSource;
  targetOrderId: string | null;
  
  addItem: (item: Omit<CartItem, 'id'>) => void;
  updateItem: (id: string, updates: Partial<CartItem>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setOrderType: (type: OrderType) => void;
  setCustomerInfo: (name: string, phone: string) => void;
  setOrderNotes: (notes: string) => void;
  clearCart: () => void;
  setSource: (source: OrderSource) => void;
  setTargetOrderId: (id: string | null) => void;
  
  // Computed (estimation only, backend is authority)
  getEstimatedSubtotal: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
  items: [],
  orderType: 'BALCAO',
  customerName: '',
  customerPhone: '',
  orderNotes: '',
  source: 'ATTENDANT',
  targetOrderId: null,

  setTargetOrderId: (targetOrderId) => set({ targetOrderId }),

  addItem: (item) => set((state) => ({ 
    items: [...state.items, { ...item, id: crypto.randomUUID() }] 
  })),

  updateItem: (id, updates) => set((state) => ({
    items: state.items.map((i) => i.id === id ? { ...i, ...updates } : i)
  })),
  
  removeItem: (id) => set((state) => ({ 
    items: state.items.filter((i) => i.id !== id) 
  })),
  
  updateQuantity: (id, quantity) => set((state) => ({
    items: state.items.map((i) => i.id === id ? { ...i, quantity } : i)
  })),
  
  setOrderType: (orderType) => set({ orderType }),
  
  setCustomerInfo: (customerName, customerPhone) => set({ customerName, customerPhone }),
  
  setOrderNotes: (orderNotes) => set({ orderNotes }),
  
  setSource: (source) => set({ source }),

  clearCart: () => set({ 
    items: [], 
    customerName: '', 
    customerPhone: '', 
    orderNotes: '', 
    targetOrderId: null 
  }),
  
  getEstimatedSubtotal: () => {
    // Estimativa visual simples. O cálculo real de total_amount é feito pelas Edge Functions.
    return get().items.reduce((total, item) => {
      let itemTotal = item.product.price;

      // Calculate addons cost
      const addonsTotal = item.addons.reduce((acc, addon) => acc + (addon.price * addon.quantity), 0);
      itemTotal += addonsTotal;

      return total + (itemTotal * item.quantity);
    }, 0);
  }
    }),
    {
      name: 'pdv-cart',
      storage: createJSONStorage(() => sessionStorage), // session-scoped: cleared on tab close
      // Only persist the data fields, not the action functions
      partialize: (state) => ({
        items:         state.items,
        orderType:     state.orderType,
        customerName:  state.customerName,
        customerPhone: state.customerPhone,
        orderNotes:    state.orderNotes,
        source:        state.source,
        targetOrderId: state.targetOrderId,
      }),
    },
  ),
);
