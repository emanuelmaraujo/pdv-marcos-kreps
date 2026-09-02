import { createClient } from "../supabase/client";

const supabase = createClient();


export interface CashReportFilters {
  start_date: string;
  end_date: string;
  category_id?: string;
  payment_method?: string;
  branch_id?: string | null;
  /** Todos, balcão, retirada ou entrega. */
  order_type?: "ALL" | "BALCAO" | "VIAGEM" | "ENTREGA";
  weekday?: "ALL" | "Domingo" | "Segunda" | "Terça" | "Quarta" | "Quinta" | "Sexta" | "Sábado";
}

export type ReportOrderType = "BALCAO" | "VIAGEM" | "ENTREGA";

export interface OrderTypeStat {
  type: ReportOrderType;
  orders: number;
  paid_orders: number;
  received: number;
  product_sales: number;
  packing_fees: number;
  delivery_fees: number;
  /** Valor da taxa de entrega reservado integralmente ao motoboy. */
  courier_reserve: number;
  /** Recebimento que permanece na loja após separar a taxa do motoboy. */
  store_received: number;
  cogs: number;
  gross_margin: number;
  average_ticket: number;
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

export interface HeatmapCell {
  weekday: string;
  hour: number;      // 0–23
  orders: number;
  received: number;
}

export interface PipelineStageStat {
  count: number;
  median: number;          // minutos
  p90: number;             // minutos
  max: number;             // minutos
  queue_loss_min: number;  // Σ (tempo − mediana) — capacidade perdida em fila
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
    cogs: number;                 // custo total dos itens vendidos (PAID)
    gross_margin: number;         // received − cogs (R$)
    gross_margin_percent: number; // % sobre received
    delivery_fees: number;
    courier_reserve: number;
    store_received: number;
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
  heatmap: HeatmapCell[];
  low_selling_products: Array<{
    product_id: string;
    name: string;
    category: string;
    quantity: number;
    revenue: number;
  }>;
  order_type_breakdown: OrderTypeStat[];
  delivery_operation: {
    total_orders: number;
    awaiting_dispatch: number;
    on_route: number;
    delivered: number;
    ready_to_dispatch: PipelineStageStat;
    dispatch_to_delivered: PipelineStageStat;
  };
  financial_attention: {
    discount_orders: number;
    discount_total: number;
    courtesy_orders: number;
    courtesy_total: number;
    canceled_orders: number;
    canceled_total: number;
  };
  pipeline_stages: {
    acceptance: PipelineStageStat;  // created_at → confirmed_at
    delivery:   PipelineStageStat;  // confirmed_at → delivered_at
    payment:    PipelineStageStat;  // created_at → paid_at
  };
  insights: Insight[];
  metadata: {
    is_filtered_by_category: boolean;
    selected_order_type?: CashReportFilters["order_type"];
    selected_weekday?: CashReportFilters["weekday"];
    /** Dias comerciais considerados nas médias, incluindo os sem pedido. */
    occurrence_count?: number | null;
    note: string | null;
  };
}

export interface OrderRecord {
  id: string;
  daily_number: number;
  status: string;
  payment_status: string;
  payment_method: string;
  source: string;
  type: ReportOrderType;
  total_amount: number;
  discount_amount: number | null;
  packing_fee: number | null;
  created_at: string;
  confirmed_at: string | null;
  paid_at: string | null;
}

export interface CourierDeliveryReportFilters {
  start_date?: string;
  end_date?: string;
  branch_id?: string | null;
}

export interface CourierDeliveryReportRow {
  courier_id: string | null;
  courier_name: string;
  branch_id: string;
  branch_name: string;
  day: string;
  deliveries: number;
  avg_dispatch_to_delivered_minutes: number | null;
  avg_ready_to_dispatch_minutes: number | null;
}

export const reportsApi = {
  async getCashReport(filters: CashReportFilters): Promise<CashReportResponse> {
    const { data, error } = await supabase.functions.invoke('cash-report', {
      body: filters
    });

    if (error) throw error;
    return data;
  },

  async getOrdersForDateRange(startISO: string, endISO: string, branchId?: string | null, orderType?: CashReportFilters["order_type"], weekday?: CashReportFilters["weekday"]): Promise<OrderRecord[]> {
    let query = supabase
      .from("orders")
      .select("id, daily_number, status, payment_status, payment_method, source, type, total_amount, discount_amount, packing_fee, created_at, confirmed_at, paid_at")
      .or([
        `and(paid_at.not.is.null,paid_at.gte.${startISO},paid_at.lte.${endISO})`,
        `and(paid_at.is.null,confirmed_at.not.is.null,confirmed_at.gte.${startISO},confirmed_at.lte.${endISO})`,
        `and(paid_at.is.null,confirmed_at.is.null,created_at.gte.${startISO},created_at.lte.${endISO})`,
      ].join(","))
      .order("created_at", { ascending: false });
    if (branchId) query = query.eq("branch_id", branchId);
    if (orderType && orderType !== "ALL") query = query.eq("type", orderType);
    const { data, error } = await query;
    if (error) throw error;
    const start = new Date(startISO).getTime();
    const end = new Date(endISO).getTime();
    return (data ?? []).filter((row) => {
      const saleTime = new Date(row.paid_at ?? row.confirmed_at ?? row.created_at).getTime();
      if (saleTime < start || saleTime > end) return false;
      if (!weekday || weekday === "ALL") return true;
      const label = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" })
        .format(new Date(row.paid_at ?? row.confirmed_at ?? row.created_at))
        .replace("-feira", "");
      return label.charAt(0).toUpperCase() + label.slice(1) === weekday;
    }).map((row) => ({
      ...row,
      total_amount: Number(row.total_amount ?? 0),
      discount_amount: row.discount_amount != null ? Number(row.discount_amount) : null,
      packing_fee: row.packing_fee != null ? Number(row.packing_fee) : null,
    }));
  },

  async getCourierDeliveryReport(filters: CourierDeliveryReportFilters): Promise<CourierDeliveryReportRow[]> {
    const { data, error } = await supabase.functions.invoke('courier-delivery-report', {
      body: filters
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Falha ao carregar relatório de entregadores');
    return data.rows ?? [];
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
