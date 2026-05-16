import { createClient } from '../supabase/client';
import { Order } from '@/types/pdv';
import { getBusinessDayRange } from '../utils/business-day';

export const ordersApi = {
  // branchId opcional: passar pra filtrar por filial (omitido = mostra todas as autorizadas pelo RLS).
  getTodayOrders: async (branchId?: string | null): Promise<Order[]> => {
    const supabase = createClient();

    const { start, end } = getBusinessDayRange();

    let query = supabase
      .from('orders')
      .select(`
        *,
        branch:branches(id, code, name, slug),
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

    if (branchId) query = query.eq('branch_id', branchId);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching today orders:', error);
      throw error;
    }

    return (data as Order[]).filter(
      (order) => !(order.source === 'APP' && order.status === 'AGUARDANDO_PAGAMENTO')
    );
  }
};
