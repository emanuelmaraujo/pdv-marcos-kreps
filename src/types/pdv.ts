// Types aligned with the real Supabase schema (init_pdv_schema + migrations)

export type UserRole = 'ADMIN' | 'ATTENDANT';
export type ProductionSector = 'KITCHEN' | 'JUICE_POTATO' | 'NONE';
export type OrderStatus =
  | 'AGUARDANDO_CONFIRMACAO'
  | 'AGUARDANDO_PAGAMENTO'
  | 'NA_FILA'
  | 'PRONTO_PARCIAL'
  | 'PRONTO'
  | 'ENTREGUE'
  | 'CANCELADO'
  | 'EXPIRADO';

export type OrderItemStatus =
  | 'PENDING'
  | 'IN_PREPARATION'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'REFUNDED' | 'CANCELED' | 'COURTESY';
export type PaymentMethod = 'PIX' | 'CASH' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'PENDING' | 'COURTESY';
export type OrderType = 'BALCAO' | 'VIAGEM';
export type OrderSource = 'ATTENDANT' | 'QR_CODE' | 'WHATSAPP' | 'APP';

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
  // Per-item lifecycle (multi-filial / per-krep tracking)
  status: OrderItemStatus;
  sequence_no?: number;
  prep_started_at?: string;
  item_ready_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  paid_at?: string;
  is_takeout?: boolean;
  product?: Product;
  removed_ingredients?: OrderItemRemovedIngredient[];
  addons?: OrderItemAddon[];
}

// ─── Orders ───────────────────────────────────────────────────────────────────

// ─── Branches ─────────────────────────────────────────────────────────────────

export type BranchType = 'STORE' | 'POPUP' | 'FAIR';

export interface Branch {
  id: string;
  code: string;          // "P", "F" — prefixo nas senhas (P-042-1)
  slug: string;          // "principal", "feira" — URL pública /pedir/[slug]
  name: string;
  type: BranchType;
  active: boolean;
  address?: string;
  phone?: string;
  printer_config?: Record<string, unknown>;
  packing_fee: number;
  ordering_enabled: boolean;
  ordering_start_time?: string;
  ordering_end_time?: string;
  whatsapp_enabled: boolean;
  whatsapp_templates?: Record<string, { template_name?: string; language?: string; enabled?: boolean }>;
  created_at?: string;
  updated_at?: string;
}

export interface Order {
  id: string;
  daily_number: number;
  branch_id: string;
  branch?: Pick<Branch, 'id' | 'code' | 'name' | 'slug'>;
  public_token: string;
  type: OrderType;
  source: OrderSource;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
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
  queue_entered_at?: string;
  preparation_started_at?: string;
  preparation_finished_at?: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  transactions?: PaymentTransaction[];
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

export interface PaymentMethodConfig {
  code: string;
  provider: 'MERCADO_PAGO' | 'NUPAY' | 'OTHER';
  label: string;
  internal_payment_method?: PaymentMethod | null;
  enabled: boolean;
  sort_order: number;
  requires_email: boolean;
  requires_document: boolean;
  requires_device_support: boolean;
  availability_reason?: string | null;
  provider_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: string;
  order_id: string;
  provider: 'MERCADO_PAGO' | 'NUPAY' | 'OTHER';
  provider_payment_id?: string | null;
  external_reference: string;
  idempotency_key: string;
  internal_payment_method?: PaymentMethod | null;
  payment_method_code: string;
  provider_payment_method_id?: string | null;
  provider_payment_type_id?: string | null;
  wallet_type?: string | null;
  provider_status: string;
  provider_status_detail?: string | null;
  amount: number;
  qr_code?: string | null;
  qr_code_base64?: string | null;
  ticket_url?: string | null;
  expires_at?: string | null;
  raw_provider_payload?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
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

export type WhatsAppEventType = 'order_received' | 'order_ready' | 'order_partial_ready';

export type WhatsAppDeliveryStatus =
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED_BY_PROVIDER'
  | 'UNDELIVERED';

export interface WhatsAppMessage {
  id: string;
  order_id: string;
  phone: string;
  event_type: WhatsAppEventType;
  message_type: string;
  template_name?: string;
  payload?: Record<string, unknown>;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  attempts: number;
  last_attempt_at?: string;
  scheduled_at: string;
  next_retry_at?: string;
  delivery_status?: WhatsAppDeliveryStatus;
  customer_opt_in?: boolean;
  error_code?: string;
  error_message?: string;
  sent_at?: string;
  provider_message_id?: string;
  created_at: string;
  updated_at: string;
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  role: UserRole;
  name: string;
  active: boolean;
  home_branch_id?: string;
  created_at: string;
}

export interface ProfileBranch {
  profile_id: string;
  branch_id: string;
  created_at?: string;
}
