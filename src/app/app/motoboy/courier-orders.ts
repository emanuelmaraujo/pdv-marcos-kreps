import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order } from "@/types/pdv";
import { getBusinessDayRange } from "@/lib/utils/business-day";

/**
 * Camada compartilhada entre a tela ao vivo (/app/motoboy) e o histórico
 * (/app/motoboy/historico).
 *
 * Decisão de modelagem: o "dia" do motoboy é ancorado em `dispatched_at`, não
 * em `delivery_delivered_at`. Motivos:
 *   1. Todo pedido despachado tem `dispatched_at` (dispatch-delivery sempre
 *      grava). Já `delivery_delivered_at` só existe depois da confirmação —
 *      então filtrar por ele esconde do motoboy o que ainda está na rua e
 *      qualquer pedido finalizado por um caminho que não gravou o campo.
 *   2. O turno do motoboy é o turno em que ele PEGOU a corrida. Uma corrida
 *      despachada 02:50 e entregue 03:05 pertence ao dia comercial em que ele
 *      saiu, não ao seguinte.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DISPLAY_TIME_ZONE = "America/Sao_Paulo";

/** Status que o motoboy vê como "na rua". */
export const ON_ROUTE_STATUS = "SAIU_PARA_ENTREGA";

export interface CourierRecord {
  id: string;
  name: string;
  branch_id: string;
  active: boolean;
}

export class CourierNotFoundError extends Error {
  constructor() {
    super("Cadastro de entregador não encontrado. Peça ao administrador para vincular seu login a um entregador.");
    this.name = "CourierNotFoundError";
  }
}

/** Cadastro em `couriers` vinculado ao profile logado (RLS: só o próprio). */
export async function fetchCourierRecord(
  supabase: SupabaseClient,
  profileId: string,
): Promise<CourierRecord> {
  const { data, error } = await supabase
    .from("couriers")
    .select("id, name, branch_id, active")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw new Error(`Erro ao carregar seu cadastro de entregador: ${error.message}`);
  if (!data) throw new CourierNotFoundError();
  return data as CourierRecord;
}

/**
 * Pedidos na rua — sem recorte de dia de propósito: uma entrega despachada
 * ontem à noite e ainda não confirmada precisa continuar aparecendo.
 */
export async function fetchOnRouteOrders(
  supabase: SupabaseClient,
  courierId: string,
): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("courier_id", courierId)
    .eq("status", ON_ROUTE_STATUS)
    .order("dispatched_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(`Erro ao carregar entregas em rota: ${error.message}`);
  return (data ?? []) as Order[];
}

/**
 * Todos os pedidos despachados para o motoboy dentro do intervalo, em qualquer
 * status final. A conclusão normal é sempre registrada pelo próprio motoboy.
 */
export async function fetchCourierOrdersBetween(
  supabase: SupabaseClient,
  courierId: string,
  start: Date,
  end: Date,
  limit = 500,
): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("courier_id", courierId)
    .gte("dispatched_at", start.toISOString())
    .lt("dispatched_at", end.toISOString())
    .order("dispatched_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Erro ao carregar histórico de entregas: ${error.message}`);
  return (data ?? []) as Order[];
}

// ─── Helpers puros (testáveis sem Supabase) ──────────────────────────────────

type OrderLike = Pick<
  Order,
  "id" | "status" | "delivery_fee" | "total_amount" | "payment_status"
> & {
  dispatched_at?: string;
  delivery_delivered_at?: string;
  created_at?: string;
};

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Instante que ancora o pedido num dia comercial. */
export function orderAnchorDate(order: OrderLike): Date | null {
  const raw = order.dispatched_at ?? order.delivery_delivered_at ?? order.created_at;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Chave "YYYY-MM-DD" do dia comercial (03h–02:59h Brasília) do pedido. */
export function orderBusinessDayKey(order: OrderLike): string | null {
  const anchor = orderAnchorDate(order);
  return anchor ? getBusinessDayRange(anchor).label : null;
}

export interface CourierBalance {
  /** Pedidos despachados no período. */
  totalOrders: number;
  delivered: number;
  onRoute: number;
  cancelled: number;
  /** Soma das taxas de entrega já concluídas — o que o motoboy ganhou. */
  earnings: number;
  /** Taxas das corridas ainda na rua (entram no saldo quando confirmadas). */
  pendingEarnings: number;
  /** Ganho médio por entrega concluída. */
  averageEarning: number;
  /** Valor dos pedidos entregues (mercadoria + taxas). */
  ordersAmount: number;
  /** Quantidade de entregas concluídas cujo pagamento ainda precisa ser conferido. */
  pendingPaymentOrders: number;
}

const PAID_STATUSES = new Set(["PAID", "COURTESY"]);

export function summarizeCourierOrders(orders: OrderLike[]): CourierBalance {
  const balance: CourierBalance = {
    totalOrders: orders.length,
    delivered: 0,
    onRoute: 0,
    cancelled: 0,
    earnings: 0,
    pendingEarnings: 0,
    averageEarning: 0,
    ordersAmount: 0,
    pendingPaymentOrders: 0,
  };

  for (const order of orders) {
    const fee = toNumber(order.delivery_fee);
    if (order.status === "ENTREGUE") {
      balance.delivered += 1;
      balance.earnings += fee;
      balance.ordersAmount += toNumber(order.total_amount);
      if (!PAID_STATUSES.has(order.payment_status)) {
        balance.pendingPaymentOrders += 1;
      }
    } else if (order.status === ON_ROUTE_STATUS) {
      balance.onRoute += 1;
      balance.pendingEarnings += fee;
    } else if (order.status === "CANCELADO" || order.status === "EXPIRADO") {
      balance.cancelled += 1;
    }
  }

  balance.averageEarning = balance.delivered > 0 ? balance.earnings / balance.delivered : 0;
  return balance;
}

export interface CourierDayGroup<T extends OrderLike = OrderLike> {
  /** "YYYY-MM-DD" do dia comercial. */
  key: string;
  orders: T[];
  balance: CourierBalance;
}

/** Agrupa por dia comercial, do mais recente para o mais antigo. */
export function groupCourierOrdersByDay<T extends OrderLike>(orders: T[]): CourierDayGroup<T>[] {
  const buckets = new Map<string, T[]>();

  for (const order of orders) {
    const key = orderBusinessDayKey(order);
    if (!key) continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(order);
    else buckets.set(key, [order]);
  }

  return [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, dayOrders]) => ({
      key,
      orders: [...dayOrders].sort(
        (a, b) => (orderAnchorDate(b)?.getTime() ?? 0) - (orderAnchorDate(a)?.getTime() ?? 0),
      ),
      balance: summarizeCourierOrders(dayOrders),
    }));
}

// ─── Períodos do filtro ──────────────────────────────────────────────────────

export type CourierPeriod = "today" | "yesterday" | "last7" | "last30" | "custom";

export const COURIER_PERIOD_LABELS: Record<CourierPeriod, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  last7: "7 dias",
  last30: "30 dias",
  custom: "Escolher dia",
};

export interface CourierDateRange {
  start: Date;
  end: Date;
}

/** "YYYY-MM-DD" de um <input type="date"> vira meio-dia local (sem pular dia). */
export function dayLabelToDate(label: string): Date {
  const [year, month, day] = label.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0);
}

/**
 * Intervalo do filtro, sempre fechado em dias comerciais para bater com o
 * caixa e com os relatórios da loja.
 */
export function courierPeriodRange(
  period: CourierPeriod,
  customDay?: string,
  reference: Date = new Date(),
): CourierDateRange {
  const today = getBusinessDayRange(reference);

  switch (period) {
    case "yesterday": {
      const start = new Date(today.start.getTime() - DAY_MS);
      return { start, end: today.start };
    }
    case "last7":
      return { start: new Date(today.start.getTime() - 6 * DAY_MS), end: today.end };
    case "last30":
      return { start: new Date(today.start.getTime() - 29 * DAY_MS), end: today.end };
    case "custom": {
      if (!customDay) return { start: today.start, end: today.end };
      const chosen = getBusinessDayRange(dayLabelToDate(customDay));
      return { start: chosen.start, end: chosen.end };
    }
    case "today":
    default:
      return { start: today.start, end: today.end };
  }
}

/** "Hoje", "Ontem" ou "seg, 08/09" a partir da chave do dia comercial. */
export function formatBusinessDayLabel(key: string, reference: Date = new Date()): string {
  const todayKey = getBusinessDayRange(reference).label;
  if (key === todayKey) return "Hoje";

  const yesterdayKey = getBusinessDayRange(
    new Date(getBusinessDayRange(reference).start.getTime() - DAY_MS),
  ).label;
  if (key === yesterdayKey) return "Ontem";

  // Meio-dia UTC evita que o fuso empurre a data para o dia anterior.
  const date = new Date(`${key}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

/** Rótulo curto do período para o cabeçalho do resumo. */
export function formatRangeLabel(range: CourierDateRange): string {
  const format = (date: Date) =>
    date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: DISPLAY_TIME_ZONE,
    });
  // `end` é exclusivo (03h do dia seguinte) — mostra o último dia incluído.
  const lastDay = new Date(range.end.getTime() - DAY_MS);
  const first = format(range.start);
  const last = format(lastDay);
  return first === last ? first : `${first} até ${last}`;
}
