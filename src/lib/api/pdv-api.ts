import { createClient } from '../supabase/client';
import { PaymentMethod, OrderStatus, OrderItemStatus, Order, PaymentTransaction } from '@/types/pdv';

export class OrderingClosedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderingClosedError';
  }
}

// Note: Ensure the client is only initialized when needed or properly passed to these functions
// For client components, this works fine.

/**
 * Extracts a clear, debug-friendly error message from a Supabase Edge Function error.
 *
 * Strategy:
 *  1. Try `error.context.json()` to parse the JSON body returned by the function.
 *  2. If that fails, try `error.context.text()` to get the raw body.
 *  3. Extract common diagnostic fields: error, message, details, hint, code.
 *  4. Build a composite message for easy debugging.
 *  5. Fallback to the generic `error.message` if nothing else is available.
 */
async function extractEdgeFunctionError(
  error: { name?: string; message?: string; context?: Response | Record<string, unknown> },
  functionName: string,
): Promise<Error> {
  console.error(`[${functionName}] Raw Error:`, error);

  let parsedBody: Record<string, unknown> | null = null;
  let rawText: string | null = null;
  let status: number | null = null;

  // --- Step 1 & 2: Try to read the response body ---
  const ctx = error.context as Response | undefined;

  if (ctx && typeof ctx.json === 'function') {
    status = ctx.status;
    try {
      // Clonamos o body para não dar erro se alguém já leu (embora improvável aqui)
      const clone = ctx.clone();
      parsedBody = await clone.json();
    } catch {
      try {
        rawText = await ctx.text();
      } catch {
        // body unreadable
      }
    }
  }

  // If context is a plain object (not a Response), use it directly
  if (!parsedBody && error.context && typeof error.context === 'object' && !(error.context instanceof Response)) {
    parsedBody = error.context as Record<string, unknown>;
  }

  const parts: string[] = [];
  if (status) parts.push(`Status: ${status}`);

  // --- Step 3: Extract diagnostic fields ---
  if (parsedBody) {
    const fields: { label: string; key: string }[] = [
      { label: 'Error', key: 'error' },
      { label: 'Message', key: 'message' },
      { label: 'Provider', key: 'provider_message' },
      { label: 'Debug', key: 'debug_code' },
      { label: 'Details', key: 'details' },
      { label: 'Code', key: 'code' },
    ];

    for (const { label, key } of fields) {
      const value = parsedBody[key];
      if (value !== undefined && value !== null && value !== '') {
        parts.push(`${label}: ${value}`);
      }
    }

    if (parts.length > 0) {
      const debugMessage = `[${functionName}] ${parts.join(' | ')}`;
      console.error(debugMessage);
      return new Error(debugMessage);
    }

    const fallbackJson = JSON.stringify(parsedBody);
    if (fallbackJson && fallbackJson !== '{}') {
      const msg = `[${functionName}] ${fallbackJson}`;
      console.error(msg);
      return new Error(msg);
    }
  }

  if (rawText) {
    const msg = `[${functionName}] ${rawText}`;
    console.error(msg);
    return new Error(msg);
  }

  const generic = error.message || 'Erro desconhecido na Edge Function';
  const msg = `[${functionName}] ${generic}${status ? ` (Status ${status})` : ''}`;
  console.error(msg);
  return new Error(msg);
}

/** Shared invoke helper — calls the Edge Function and handles errors uniformly. */
async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  payload: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload,
    headers: {
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...extraHeaders,
    },
  });

  if (error) {
    throw await extractEdgeFunctionError(error, functionName);
  }

  return data as T;
}

export type CreateAttendantOrderResponse = {
  success: boolean;
  order: {
    order_id: string;
    daily_number: number;
    status: string;
    payment_status: string;
    payment_method: string;
    subtotal_amount?: number;
    discount_amount?: number;
    packaging_fee?: number;
    total_amount: number;
  };
  printer_jobs?: { type: string; id: string }[];
};

export type AddItemsToOrderPayload = {
  order_id: string;
  items: Array<{
    product_id: string;
    quantity: number;
    removed_ingredient_ids?: string[];
    addons?: Array<{
      addon_id: string;
      quantity?: number;
    }>;
    notes?: string;
  }>;
};

export type AddItemsToOrderResponse = {
  success: boolean;
  order: {
    id: string;
    total_amount: number;
  };
  printer_jobs?: { type: string; id: string }[];
};

export type CreatePublicOrderPayload = {
  order_type: 'BALCAO' | 'VIAGEM';
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  marketing_opt_in?: boolean;
  remember_checkout_data?: boolean;
  notes?: string;
  payment_method_code?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    removed_ingredient_ids?: string[];
    addons?: Array<{
      addon_id: string;
      quantity?: number;
    }>;
    notes?: string;
  }>;
};

export type CreatePublicOrderResponse = {
  success: boolean;
  order: {
    order_id: string;
    daily_number: number;
    public_token: string;
    total_amount: number;
    status: OrderStatus;
    payment_status: string;
    payment_method_code: string;
  };
};

export type MercadoPagoPaymentResponse = {
  success: boolean;
  configuration_required?: boolean;
  already_paid?: boolean;
  error?: string;
  debug_code?: string;
  provider_message?: string | null;
  provider_causes?: Array<{
    code?: string | number | null;
    description?: string | null;
    data?: unknown;
  }>;
  payment?: {
    id: number | string;
    status: string;
    status_detail?: string;
    payment_method_id?: string;
    payment_type_id?: string;
    point_of_interaction?: {
      transaction_data?: {
        qr_code?: string;
        qr_code_base64?: string;
        ticket_url?: string;
      };
    };
  };
  transaction?: Partial<PaymentTransaction>;
  order?: {
    payment_status: string;
  };
};

export type PublicOrderStatusResponse = {
  success: boolean;
  order: {
    daily_number: number;
    status: OrderStatus;
    payment_status: string;
    payment_method: PaymentMethod;
    total: number;
    customer_name?: string;
    created_at: string;
    confirmed_at?: string;
    ready_at?: string;
    delivered_at?: string;
  };
  transaction?: Partial<PaymentTransaction> | null;
  items?: Array<{
    id: string;
    product_name: string;
    product_price: number;
    quantity: number;
    observation?: string | null;
    total_price: number;
    addons: Array<{ name: string; quantity: number; price: number }>;
    removed_ingredients: string[];
  }>;
};

export type PublicCustomerProfileResponse = {
  success: boolean;
  found: boolean;
  profile?: {
    name?: string | null;
    email?: string | null;
    order_type?: 'BALCAO' | 'VIAGEM' | null;
    marketing_opt_in?: boolean;
  };
};

export type AttendantCustomerProfileResponse = {
  success: boolean;
  found: boolean;
  profile?: {
    name?: string | null;
    email?: string | null;
    order_type?: 'BALCAO' | 'VIAGEM' | null;
    marketing_opt_in?: boolean;
    remember_checkout_data?: boolean;
    orders_count?: number;
    last_order_at?: string | null;
  };
};

export type PublicCheckoutConfigResponse = {
  success: boolean;
  error?: string;
  settings: {
    public_ordering_enabled: string;
    public_ordering_start_time: string;
    public_ordering_end_time: string;
    packaging_fee: string;
    apply_packaging_fee_for_takeout: string;
  };
  online_ordering_enabled: boolean;
  ordering_closed_reason: string;
};

export const pdvApi = {
  getOrder: async (id: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*, product:products(*), addons:order_item_addons(*, addon:addons(*)), removed_ingredients:order_item_removed_ingredients(*, ingredient:ingredients(*)))')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as Order;
  },

  createPublicOrder: async (payload: CreatePublicOrderPayload): Promise<CreatePublicOrderResponse> => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('create-public-order', {
      body: payload,
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
    });

    if (error) {
      const ctx = (error as { context?: Response }).context;
      if (ctx instanceof Response) {
        try {
          const body = await ctx.clone().json() as Record<string, unknown>;
          if (body.ordering_closed || body.ordering_disabled) {
            throw new OrderingClosedError(typeof body.error === 'string' ? body.error : 'No momento nao estamos recebendo pedidos.');
          }
        } catch (e) {
          if (e instanceof OrderingClosedError) throw e;
        }
      }
      throw await extractEdgeFunctionError(error, 'create-public-order');
    }

    return data as CreatePublicOrderResponse;
  },

  getPublicOrderStatus: (payload: { public_token: string }) =>
    invokeEdgeFunction<PublicOrderStatusResponse>('get-public-order-status', payload),

  getPublicCustomerProfile: async (payload: { customer_phone: string }) => {
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke('get-public-customer-profile', {
      body: payload,
    });

    if (error) {
      return { success: false, found: false } as PublicCustomerProfileResponse;
    }

    return data as PublicCustomerProfileResponse;
  },

  // Authenticated lookup for ADMIN/ATTENDANT — returns any customer matching
  // the phone, regardless of remember_checkout_data. Used by /app/novo-pedido.
  getCustomerProfile: async (payload: { customer_phone: string }) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('get-customer-profile', {
      body: payload,
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    if (error) {
      return { success: false, found: false } as AttendantCustomerProfileResponse;
    }
    return data as AttendantCustomerProfileResponse;
  },

  getPublicCheckoutConfig: () =>
    invokeEdgeFunction<PublicCheckoutConfigResponse>('get-public-checkout-config', {}),

  createMercadoPagoPayment: (payload: {
    order_id: string;
    public_token: string;
    payment_method_code: string;
    form_data?: Record<string, unknown>;
    direct_payment_method?: 'pix';
    idempotency_key: string;
  }) =>
    invokeEdgeFunction<MercadoPagoPaymentResponse>(
      'create-mercado-pago-payment',
      payload,
      { 'x-idempotency-key': payload.idempotency_key },
    ),

  confirmOrder: (orderId: string) =>
    invokeEdgeFunction('confirm-order', { order_id: orderId }),

  markPayment: (payload: {
    orderId: string;
    paymentMethod: PaymentMethod;
    status: string;
    amount?: number;
    notes?: string;
    orderItemIds?: string[];
  }) =>
    invokeEdgeFunction('mark-payment', {
      order_id: payload.orderId,
      payment_method: payload.paymentMethod,
      payment_status: payload.status,
      amount: payload.amount,
      notes: payload.notes,
      order_item_ids: payload.orderItemIds,
    }),

  updateOrderStatus: (payload: { orderId: string; newStatus: OrderStatus; reason?: string; forceDelivery?: boolean }) =>
    invokeEdgeFunction('update-order-status', {
      order_id: payload.orderId,
      status: payload.newStatus,
      reason: payload.reason,
      force_delivery: payload.forceDelivery
    }),

  updateOrderItemStatus: (payload: {
    orderItemId: string;
    newStatus: OrderItemStatus;
    reason?: string;
  }) =>
    invokeEdgeFunction<{
      success: boolean;
      item: { id: string; sequence_no: number; status: OrderItemStatus };
      order: { id: string; status: OrderStatus; payment_status: string; ready_at?: string; delivered_at?: string };
    }>('update-order-item-status', {
      order_item_id: payload.orderItemId,
      new_status: payload.newStatus,
      reason: payload.reason,
    }),

  createAttendantOrder: (payload: Record<string, unknown>) =>
    invokeEdgeFunction<CreateAttendantOrderResponse>('create-attendant-order', payload),

  reprintOrder: (payload: { orderId: string; copies?: ('CUSTOMER' | 'KITCHEN' | 'JUICE_POTATO')[] }) =>
    invokeEdgeFunction('reprint-order', {
      order_id: payload.orderId,
      copies: payload.copies
    }),

  addItemsToOrder: (payload: AddItemsToOrderPayload) =>
    invokeEdgeFunction<AddItemsToOrderResponse>('add-items-to-order', {
      order_id: payload.order_id,
      items: payload.items
    }),
};
