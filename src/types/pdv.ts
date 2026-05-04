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

export interface Addon {
  id: string;
  name: string;
  price: number;
  active: boolean;
  created_at?: string;
}

export interface OrderItemAddon {
  id?: string;
  order_item_id?: string;
  addon_id: string;
  price_at_time: number;
  addon?: Addon;
}

export interface RemovedIngredient {
  id?: string;
  order_item_id?: string;
  ingredient_id: string;
  ingredient?: Ingredient;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  production_sector: ProductionSector;
  product?: Product;
  removed_ingredients?: RemovedIngredient[];
  addons?: OrderItemAddon[];
}

export interface Order {
  id: string;
  daily_number: number;
  public_token: string;
  source: OrderSource;
  order_type: OrderType;
  customer_name?: string;
  customer_phone?: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  subtotal_amount: number;
  discount_amount: number;
  packaging_fee: number;
  total_amount: number;
  notes?: string;
  created_by?: string;
  confirmed_by?: string;
  cancelled_by?: string;
  created_at: string;
  confirmed_at?: string;
  paid_at?: string;
  ready_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  items?: OrderItem[];
}

export interface PrinterJob {
  id: string;
  order_id: string;
  printer_id?: string;
  target_sector: 'KITCHEN' | 'JUICE_POTATO' | 'CUSTOMER';
  status: 'PENDING' | 'PRINTED' | 'FAILED';
  content: Record<string, unknown>; // Using Record for JSONB structure placeholder
  created_at: string;
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

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  created_at: string;
}

export interface Discount {
  id: string;
  order_id: string;
  amount: number;
  reason?: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name?: string;
  phone: string;
  total_orders: number;
  total_spent: number;
  last_order_at?: string;
  created_at: string;
}

export interface CashSession {
  id: string;
  opened_by: string;
  opened_at: string;
  closed_by?: string;
  closed_at?: string;
  initial_balance: number;
  final_balance?: number;
  expected_balance?: number;
  status: 'OPEN' | 'CLOSED';
}
