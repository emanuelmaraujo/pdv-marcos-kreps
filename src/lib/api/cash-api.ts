import { createClient } from "../supabase/client";
import { OrderStatus, PaymentMethod, PaymentStatus, UserRole } from "@/types/pdv";

interface CashOrderRow {
  id: string;
  daily_number: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  discount_amount: number | string | null;
  packing_fee: number | string | null;
  total_amount: number | string | null;
  created_at: string;
  paid_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
}

interface OrderItemRow {
  product_name_snapshot: string;
  quantity: number | string | null;
  total_price: number | string | null;
  order_id: string;
}

export interface DaySummary {
  totalBruto: number;
  totalRecebido: number;
  totalPendente: number;
  totalCortesia: number;
  totalCancelado: number;
  totalDescontos: number;
  totalEmbalagem: number;
  ticketMedio: number;
  totalPedidos: number;
  pedidosPagos: number;
  pedidosPendentes: number;
  pedidosCancelados: number;
  pedidosCortesia: number;
  pedidosComDesconto: number;
}

export interface PaymentBreakdown {
  method: PaymentMethod;
  label: string;
  count: number;
  total: number;
}

export interface StatusBreakdown {
  status: OrderStatus;
  label: string;
  count: number;
}

export interface PendingOrder {
  id: string;
  daily_number: number;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
}

export interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

export interface CaixaData {
  role: UserRole | null;
  orders: CashOrderRow[];
  summary: DaySummary;
  paymentBreakdown: PaymentBreakdown[];
  statusBreakdown: StatusBreakdown[];
  pendingOrders: PendingOrder[];
  topProducts: TopProduct[];
  generatedAt: string;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  PIX: "Pix",
  CASH: "Dinheiro",
  DEBIT_CARD: "Debito",
  CREDIT_CARD: "Credito",
  COURTESY: "Cortesia",
  PENDING: "Pendente",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  AGUARDANDO_CONFIRMACAO: "Aguardando confirmacao",
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  NA_FILA: "Na fila",
  PRONTO: "Pronto",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
  EXPIRADO: "Expirado",
};

const CASH_STATUSES: OrderStatus[] = [
  "NA_FILA",
  "PRONTO",
  "ENTREGUE",
  "CANCELADO",
  "AGUARDANDO_CONFIRMACAO",
  "AGUARDANDO_PAGAMENTO",
];

const PAYMENT_METHODS: PaymentMethod[] = [
  "PIX",
  "CASH",
  "DEBIT_CARD",
  "CREDIT_CARD",
  "COURTESY",
  "PENDING",
];

function money(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumOrders(orders: CashOrderRow[]): number {
  return orders.reduce((total, order) => total + money(order.total_amount), 0);
}

function friendlyError(message: string): Error {
  const lower = message.toLowerCase();
  if (
    lower.includes("permission") ||
    lower.includes("policy") ||
    lower.includes("rls") ||
    lower.includes("not authorized")
  ) {
    return new Error(
      "Seu perfil nao tem permissao para acessar todos os dados do caixa. Peça a um administrador para revisar as politicas de acesso."
    );
  }

  return new Error(message);
}

export const cashApi = {
  getDaySummary: async (): Promise<CaixaData> => {
    const supabase = createClient();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let role: UserRole | null = null;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      role = (profile?.role as UserRole | undefined) ?? null;
    }

    const { data: rawOrders, error: ordersError } = await supabase
      .from("orders")
      .select(
        "id, daily_number, status, payment_status, payment_method, discount_amount, packing_fee, total_amount, created_at, paid_at, delivered_at, cancelled_at"
      )
      .gte("created_at", startOfDay.toISOString())
      .order("created_at", { ascending: false });

    if (ordersError) {
      throw friendlyError(`Erro ao carregar pedidos do caixa: ${ordersError.message}`);
    }

    const orders = (rawOrders ?? []) as CashOrderRow[];
    const nonCancelled = orders.filter((order) => order.status !== "CANCELADO");
    const paid = orders.filter(
      (order) => order.payment_status === "PAID" && order.status !== "CANCELADO"
    );
    const pending = orders.filter(
      (order) => order.payment_status === "PENDING" && order.status !== "CANCELADO"
    );
    const courtesy = orders.filter(
      (order) => order.payment_status === "COURTESY" && order.status !== "CANCELADO"
    );
    const cancelled = orders.filter((order) => order.status === "CANCELADO");

    const totalRecebido = sumOrders(paid);

    const summary: DaySummary = {
      totalBruto: sumOrders(nonCancelled),
      totalRecebido,
      totalPendente: sumOrders(pending),
      totalCortesia: sumOrders(courtesy),
      totalCancelado: sumOrders(cancelled),
      totalDescontos: nonCancelled.reduce(
        (total, order) => total + money(order.discount_amount),
        0
      ),
      totalEmbalagem: nonCancelled.reduce(
        (total, order) => total + money(order.packing_fee),
        0
      ),
      ticketMedio: paid.length > 0 ? totalRecebido / paid.length : 0,
      totalPedidos: orders.length,
      pedidosPagos: paid.length,
      pedidosPendentes: pending.length,
      pedidosCancelados: cancelled.length,
      pedidosCortesia: courtesy.length,
      pedidosComDesconto: nonCancelled.filter((order) => money(order.discount_amount) > 0)
        .length,
    };

    const paymentBreakdown: PaymentBreakdown[] = PAYMENT_METHODS.map((method) => {
      const matching =
        method === "PENDING"
          ? pending
          : method === "COURTESY"
            ? courtesy
            : paid.filter((order) => order.payment_method === method);

      return {
        method,
        label: PAYMENT_LABELS[method],
        count: matching.length,
        total: sumOrders(matching),
      };
    });

    const statusBreakdown: StatusBreakdown[] = CASH_STATUSES.map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: orders.filter((order) => order.status === status).length,
    }));

    const pendingOrders: PendingOrder[] = pending.map((order) => ({
      id: order.id,
      daily_number: order.daily_number,
      total_amount: money(order.total_amount),
      status: order.status,
      created_at: order.created_at,
    }));

    const orderIdsForProducts = nonCancelled.map((order) => order.id);
    let orderItems: OrderItemRow[] = [];

    if (orderIdsForProducts.length > 0) {
      const { data: rawItems, error: itemsError } = await supabase
        .from("order_items")
        .select("product_name_snapshot, quantity, total_price, order_id")
        .in("order_id", orderIdsForProducts);

      if (itemsError) {
        throw friendlyError(`Erro ao carregar produtos vendidos: ${itemsError.message}`);
      }

      orderItems = (rawItems ?? []) as OrderItemRow[];
    }

    const productMap = new Map<string, { quantity: number; revenue: number }>();
    for (const item of orderItems) {
      const name = item.product_name_snapshot || "Produto sem nome";
      const current = productMap.get(name) ?? { quantity: 0, revenue: 0 };
      current.quantity += money(item.quantity);
      current.revenue += money(item.total_price);
      productMap.set(name, current);
    }

    const topProducts = Array.from(productMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 5);

    return {
      role,
      orders,
      summary,
      paymentBreakdown,
      statusBreakdown,
      pendingOrders,
      topProducts,
      generatedAt: new Date().toISOString(),
    };
  },
};
