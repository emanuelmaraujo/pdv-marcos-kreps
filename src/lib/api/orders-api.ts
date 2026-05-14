import { createClient } from '../supabase/client';
import { Order } from '@/types/pdv';
import { getBusinessDayRange } from '../utils/business-day';

export const ordersApi = {
  getTodayOrders: async (): Promise<Order[]> => {
    const supabase = createClient();

    const { start, end } = getBusinessDayRange();

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(
          *,
          product:products(*),
          addons:order_item_addons(
            *,
            addon:addons(*)
          ),
          removed_ingredients:order_item_removed_ingredients(
            *,
            ingredient:ingredients(*)
          )
        ),
        transactions:payment_transactions(*)
      `)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching today orders:', error);
      throw error;
    }

    return (data as Order[]).filter(
      (order) => !(order.source === 'APP' && order.status === 'AGUARDANDO_PAGAMENTO')
    );
  }
};
