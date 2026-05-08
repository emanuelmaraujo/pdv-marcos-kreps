import { createClient } from "../supabase/client";

const supabase = createClient();


export interface CashReportFilters {
  start_date: string;
  end_date: string;
  category_id?: string;
  payment_method?: string;
}

export interface ProductStat {
  name: string;
  category: string;
  quantity: number;
  revenue: number;
  percent?: number;
}

export interface CategoryStat {
  category_name: string;
  quantity: number;
  revenue: number;
  orders_count: number;
  percent: number;
}

export interface HourlyStat {
  range: string;
  orders: number;
  items_quantity: number;
  received: number;
  percent_of_peak: number;
}

export interface WeekdayStat {
  weekday: string;
  orders: number;
  received: number;
  average_ticket: number;
}

export interface Insight {
  title: string;
  description: string;
  severity: 'positive' | 'info' | 'warning' | 'negative';
}

export interface CashReportResponse {
  summary: {
    received: number;
    pending: number;
    courtesy: number;
    canceled: number;
    gross_sales: number;
    discounts: number;
    total_orders: number;
    paid_orders: number;
    average_ticket: number;
  };
  payment_breakdown: Array<{
    method: string;
    total: number;
    count: number;
    percent: number;
  }>;
  category_breakdown: CategoryStat[];
  top_all_products: ProductStat[];
  category_rankings: {
    savory_kreps: ProductStat[];
    sweet_kreps: ProductStat[];
    juices: ProductStat[];
    sodas: ProductStat[];
    potatoes: ProductStat[];
    creams: ProductStat[];
    others: ProductStat[];
  };
  hourly_sales: HourlyStat[];
  weekday_sales: WeekdayStat[];
  low_selling_products: Array<{
    product_id: string;
    name: string;
    category: string;
    quantity: number;
    revenue: number;
  }>;
  financial_attention: {
    discount_orders: number;
    discount_total: number;
    courtesy_orders: number;
    courtesy_total: number;
    canceled_orders: number;
    canceled_total: number;
  };
  insights: Insight[];
  metadata: {
    is_filtered_by_category: boolean;
    note: string | null;
  };
}

export const reportsApi = {
  async getCashReport(filters: CashReportFilters): Promise<CashReportResponse> {
    const { data, error } = await supabase.functions.invoke('cash-report', {
      body: filters
    });

    if (error) throw error;
    return data;
  },

  async getCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name')
      .eq('active', true)
      .order('sort_order');

    if (error) throw error;
    return data || [];
  }
};
