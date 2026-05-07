import { createClient } from '../supabase/client';
import { PaymentMethod, OrderStatus, Order } from '@/types/pdv';

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
): Promise<T> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload,
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
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

  createPublicOrder: (payload: Record<string, unknown>) =>
    invokeEdgeFunction('create-public-order', payload),

  getPublicOrderStatus: (payload: { daily_number: number; public_token: string }) =>
    invokeEdgeFunction('get-public-order-status', payload),

  confirmOrder: (orderId: string) =>
    invokeEdgeFunction('confirm-order', { order_id: orderId }),

  markPayment: (payload: { orderId: string; paymentMethod: PaymentMethod; status: string; amount?: number; notes?: string }) =>
    invokeEdgeFunction('mark-payment', {
      order_id: payload.orderId,
      payment_method: payload.paymentMethod,
      payment_status: payload.status,
      amount: payload.amount,
      notes: payload.notes
    }),

  updateOrderStatus: (payload: { orderId: string; newStatus: OrderStatus; reason?: string; forceDelivery?: boolean }) =>
    invokeEdgeFunction('update-order-status', {
      order_id: payload.orderId,
      status: payload.newStatus,
      reason: payload.reason,
      force_delivery: payload.forceDelivery
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
