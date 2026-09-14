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
          id,
          order_id,
          product_id,
          product_name_snapshot,
          product_price_snapshot,
          production_sector,
          quantity,
          observation,
          total_price,
          created_at,
          status,
          sequence_no,
          addition_batch_no,
          prep_started_at,
          item_ready_at,
          delivered_at,
          cancelled_at,
          payment_status,
          payment_method,
          paid_at,
          is_takeout,
          product:products(category_id),
          addons:order_item_addons(
            id,
            order_item_id,
            addon_id,
            quantity,
            addon_name_snapshot,
            addon_price_snapshot
          ),
          removed_ingredients:order_item_removed_ingredients(
            id,
            order_item_id,
            ingredient_id,
            ingredient_name_snapshot
          )
        )
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
