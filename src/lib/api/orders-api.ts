import { createClient } from '../supabase/client';
import { Order } from '@/types/pdv';

export const ordersApi = {
  getTodayOrders: async (): Promise<Order[]> => {
    const supabase = createClient();
    
    // Get start of today (local time)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

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
        )
      `)
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching today orders:', error);
      throw error;
    }

    return data as Order[];
  }
};
