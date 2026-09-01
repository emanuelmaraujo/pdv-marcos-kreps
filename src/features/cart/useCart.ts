import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { Product, OrderType, OrderSource } from '@/types/pdv';

// Carrinho sobrevive a fechar/reabrir a aba (ex: cliente troca pro app do
// banco pra pagar o Pix e volta) — sessionStorage não sobrevive a isso.
// TTL curto (24h, não os 90 dias do perfil salvo) porque aqui o risco é
// diferente: preço e disponibilidade de produto podem mudar, um carrinho de
// dias atrás reaparecendo seria mais confuso que útil.
const CART_TTL_MS = 24 * 60 * 60 * 1000;

const cartStorage: StateStorage = {
  getItem: (name) => {
    const raw = localStorage.getItem(name);
    if (!raw) return null;
    try {
      const envelope = JSON.parse(raw) as { __savedAt?: number };
      if (envelope.__savedAt && Date.now() - envelope.__savedAt > CART_TTL_MS) {
        localStorage.removeItem(name);
        return null;
      }
    } catch {
      // Formato inesperado — deixa o zustand tentar parsear e lidar com o erro.
    }
    return raw;
  },
  setItem: (name, value) => {
    try {
      const envelope = JSON.parse(value) as Record<string, unknown>;
      envelope.__savedAt = Date.now();
      localStorage.setItem(name, JSON.stringify(envelope));
    } catch {
      localStorage.setItem(name, value);
    }
  },
  removeItem: (name) => localStorage.removeItem(name),
};

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
  /** Slug da filial pública (/pedir/[slug]) dona destes itens — `null` fora do
   * fluxo público (PDV interno). Usado para detectar carrinho "órfão" de uma
   * filial diferente da que o cliente está navegando agora. */
  branchSlug: string | null;

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
  setBranchSlug: (slug: string | null) => void;

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
  branchSlug: null,

  setTargetOrderId: (targetOrderId) => set({ targetOrderId }),
  setBranchSlug: (branchSlug) => set({ branchSlug }),

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

  clearCart: () => set((state) => ({
    items: [],
    orderType: 'BALCAO',
    customerName: '',
    customerPhone: '',
    orderNotes: '',
    targetOrderId: null,
    // branchSlug fica de fora do reset: quem chama clearCart() ao trocar de
    // filial é responsável por chamar setBranchSlug() logo em seguida.
    branchSlug: state.branchSlug,
  })),
  
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
      storage: createJSONStorage(() => cartStorage), // localStorage + TTL de 24h, ver cartStorage acima
      // Only persist the data fields, not the action functions
      partialize: (state) => ({
        items:         state.items,
        orderType:     state.orderType,
        orderNotes:    state.orderNotes,
        source:        state.source,
        targetOrderId: state.targetOrderId,
        branchSlug:    state.branchSlug,
      }),
      // Identificação é específica de cada pagamento. Não a reidrata de uma
      // sessão anterior, mas mantém o rascunho enquanto a pessoa apenas fecha
      // e reabre o checkout na mesma sessão.
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<CartState>;
        const cart = { ...persisted };
        delete cart.customerName;
        delete cart.customerPhone;
        return {
          ...currentState,
          ...cart,
          customerName: "",
          customerPhone: "",
        };
      },
    },
  ),
);
