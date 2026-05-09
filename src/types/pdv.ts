// Types aligned with the real Supabase schema (init_pdv_schema + migrations)

export type UserRole = 'ADMIN' | 'ATTENDANT';
export type ProductionSector = 'KITCHEN' | 'JUICE_POTATO' | 'NONE';
export type OrderStatus =
  | 'AGUARDANDO_CONFIRMACAO'
  | 'AGUARDANDO_PAGAMENTO'
  | 'NA_FILA'
  | 'PRONTO'
  | 'ENTREGUE'
  | 'CANCELADO'
  | 'EXPIRADO';

export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED' | 'CANCELED' | 'COURTESY';
export type PaymentMethod = 'PIX' | 'CASH' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'PENDING' | 'COURTESY';
export type OrderType = 'BALCAO' | 'VIAGEM';
export type OrderSource = 'ATTENDANT' | 'QR_CODE' | 'WHATSAPP';

// ─── Menu ─────────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
  created_at?: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  sector: ProductionSector;
  active: boolean;
  created_at?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  active: boolean;
  created_at?: string;
}

export interface ProductIngredient {
  id: string;
  product_id: string;
  ingredient_id: string;
  created_at?: string;
}

export interface ProductAddon {
  product_id: string;
  addon_id: string;
  is_required: boolean;
  max_quantity: number;
  created_at?: string;
}

export interface Addon {
  id: string;
  name: string;
  price: number;
  active: boolean;
  created_at?: string;
}

// ─── Order items ──────────────────────────────────────────────────────────────

export interface OrderItemAddon {
  id?: string;
  order_item_id?: string;
  addon_id: string | null;
  quantity: number;
  addon_name_snapshot: string;
  addon_price_snapshot: number;
  addon?: Addon;
}

export interface OrderItemRemovedIngredient {
  id?: string;
  order_item_id?: string;
  ingredient_id: string | null;
  ingredient_name_snapshot: string;
  ingredient?: Ingredient;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name_snapshot: string;
  product_price_snapshot: number;
  production_sector: ProductionSector;
  quantity: number;
  observation?: string;
  total_price: number;
  created_at?: string;
  product?: Product;
  removed_ingredients?: OrderItemRemovedIngredient[];
  addons?: OrderItemAddon[];
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface Order {
  id: string;
  daily_number: number;
  public_token: string;
  type: OrderType;
  source: OrderSource;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  customer_name?: string;
  customer_phone?: string;
  notes?: string;
  discount_amount: number;
  discount_percentage: number;
  discount_reason?: string;
  discount_applied_by?: string;
  packing_fee: number;
  total_amount: number;
  created_by?: string;
  confirmed_by?: string;
  confirmed_at?: string;
  ready_at?: string;
  delivered_at?: string;
  paid_at?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

// ─── Cash & Payments ──────────────────────────────────────────────────────────

export interface CashSession {
  id: string;
  opened_by: string;
  closed_by?: string;
  opened_at: string;
  closed_at?: string;
  initial_amount: number;
  final_amount?: number;
  notes?: string;
}

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  received_by?: string;
  notes?: string;
  created_at: string;
}

export interface Discount {
  id: string;
  order_id: string;
  type: 'AMOUNT' | 'PERCENT';
  value: number;
  amount_applied: number;
  reason: string;
  granted_by?: string;
  created_at: string;
}

// ─── Printer ─────────────────────────────────────────────────────────────────

export interface PrinterJob {
  id: string;
  order_id: string;
  sector: 'KITCHEN' | 'JUICE_POTATO' | 'CUSTOMER';
  status: 'PENDING' | 'PRINTED' | 'FAILED';
  content: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  printed_at?: string;
  error_message?: string;
  order?: {
    daily_number: number;
    status: OrderStatus;
    payment_status: PaymentStatus;
    total_amount: number;
    customer_name?: string;
  };
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

export interface WhatsAppMessage {
  id: string;
  order_id: string;
  phone: string;
  message_type: string;
  template_name?: string;
  payload?: Record<string, unknown>;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  attempts: number;
  last_attempt_at?: string;
  created_at: string;
  updated_at: string;
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  role: UserRole;
  name: string;
  active: boolean;
  created_at: string;
}
