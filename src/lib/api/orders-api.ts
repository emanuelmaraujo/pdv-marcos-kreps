import { createClient } from '../supabase/client';
import { Order } from '@/types/pdv';

export const ordersApi = {
  getTodayOrders: async (): Promise<Order[]> => {
    const supabase = createClient();
    
    // Get start of today in America/Sao_Paulo (UTC-3) — matches the DB trigger
    // We build an ISO string for midnight Brasília time so the .gte filter is correct
    // regardless of where the browser/server is running.
    const tz = 'America/Sao_Paulo';
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const year  = parts.find(p => p.type === 'year')!.value;
    const month = parts.find(p => p.type === 'month')!.value;
    const day   = parts.find(p => p.type === 'day')!.value;
    // Midnight in Sao Paulo expressed as UTC offset string
    const startOfDay = new Date(`${year}-${month}-${day}T00:00:00-03:00`);

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
      .gte('created_at', startOfDay.toISOString())
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
