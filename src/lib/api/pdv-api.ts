import { createClient } from '../supabase/client';
import { PaymentMethod, OrderStatus } from '@/types/pdv';

// Note: Ensure the client is only initialized when needed or properly passed to these functions
// For client components, this works fine.

export const pdvApi = {
  createPublicOrder: async (payload: Record<string, unknown>) => {
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke('create-public-order', {
      body: payload,
    });
    if (error) throw error;
    return data;
  },

  getPublicOrderStatus: async (payload: { daily_number: number; public_token: string }) => {
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke('get-public-order-status', {
      body: payload,
    });
    if (error) throw error;
    return data;
  },

  confirmOrder: async (orderId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke('confirm-order', {
      body: { orderId },
    });
    if (error) throw error;
    return data;
  },

  markPayment: async (payload: { orderId: string; paymentMethod: PaymentMethod; status: string }) => {
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke('mark-payment', {
      body: payload,
    });
    if (error) throw error;
    return data;
  },

  updateOrderStatus: async (payload: { orderId: string; newStatus: OrderStatus; reason?: string; forceDelivery?: boolean }) => {
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke('update-order-status', {
      body: payload,
    });
    if (error) throw error;
    return data;
  },

  createAttendantOrder: async (payload: Record<string, unknown>) => {
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke('create-attendant-order', {
      body: payload,
    });
    if (error) throw error;
    return data;
  },

  reprintOrder: async (payload: { orderId: string; copies?: ('CUSTOMER' | 'KITCHEN' | 'JUICE_POTATO')[] }) => {
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke('reprint-order', {
      body: payload,
    });
    if (error) throw error;
    return data;
  }
};
