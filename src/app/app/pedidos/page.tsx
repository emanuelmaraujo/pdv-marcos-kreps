"use client";

import { HandoffSettings } from './components/HandoffSettings';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Order, OrderStatus } from "@/types/pdv";
import { ordersApi } from "@/lib/api/orders-api";
import { pdvApi } from "@/lib/api/pdv-api";
import { menuApi } from "@/lib/api/menu-api";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/contexts/BranchContext";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";
import { getSelectedOrderSyncCandidate, hasOrderBoardChanged, mergeRefreshedOrders } from "@/lib/utils/order-refresh";
import { ORDER_BOARD_RECONCILE_INTERVAL_MS, shouldReconcileOrderBoard } from "@/lib/utils/order-board-sync";
import { orderMatchesSearch } from "@/lib/utils/order-search";
import { ToastContainer, useToast } from "@/components/ui/Toast";
import { OrderCard } from "./components/OrderCard";
import { OrderDetailsSheet } from "./components/OrderDetailsSheet";
import { PayItemsModal } from "./components/PayItemsModal";
import { categoryLookup, CategoryLookup } from "./components/order-item-presentation";
import {
  ClipboardList,
  Clock,
  CreditCard,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBag,
  type LucideIcon,
  Radio,
  EyeOff,
  Eye,
  ChevronDown,
  ChevronRight,
  Focus as FocusIcon,
} from "lucide-react";

// Próximo status é determinístico para estas transições (ao contrário de
// PRONTO_PARCIAL, cujo status final é derivado por trigger no servidor a
// partir de quais itens ficam prontos — arriscado adivinhar). Só nesses
// casos vale atualizar a UI antes da resposta da API.
const OPTIMISTIC_NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  AGUARDANDO_CONFIRMACAO: "NA_FILA",
  NA_FILA: "PRONTO",
  PRONTO: "ENTREGUE",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type TabStatus =
  | "AGORA"
  | "PRODUCAO"
  | "ENTREGA"
  | "CONCLUIDOS"
  | "TODOS"
  | "PAGAMENTO_PENDENTE"
  | "AGUARDANDO_CONFIRMACAO"
  | "NA_FILA"
  | "PRONTO_PARCIAL"
  | "PRONTO"
  | "SAIU_PARA_ENTREGA"
  | "ENTREGUE_PENDENTE"
  | "ENTREGUE"
  | "CANCELADO";

interface KanbanColumnConfig {
  status: OrderStatus;
  label: string;
  topColor: string;
  headerBg: string;
  emptyText: string;
  showAvgWait: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ORDERS_FOCUS_MODE_STORAGE_KEY = "pdv:orders-focus-mode";
const ORDERS_FOCUS_MODE_EVENT = "pdv:orders-focus-mode-change";

const STATUS_SORT_ORDER: Record<OrderStatus, number> = {
  NA_FILA: 0,
  AGUARDANDO_CONFIRMACAO: 1,
  AGUARDANDO_PAGAMENTO: 2,
  PRONTO_PARCIAL: 3,
  PRONTO: 4,
  SAIU_PARA_ENTREGA: 5,
  ENTREGUE: 6,
  CANCELADO: 7,
  EXPIRADO: 8,
};

const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    status: "AGUARDANDO_CONFIRMACAO",
    label: "Aguardando",
    topColor: "bg-[var(--status-warning)]",
    headerBg: "bg-[var(--status-warning-bg)] border-transparent",
    emptyText: "Sem pedidos aguardando",
    showAvgWait: true,
  },
  {
    status: "NA_FILA",
    label: "Na fila",
    topColor: "bg-[var(--status-info)]",
    headerBg: "bg-[var(--status-info-bg)] border-transparent",
    emptyText: "Fila vazia",
    showAvgWait: true,
  },
  {
    status: "PRONTO_PARCIAL",
    label: "Pronto parcial",
    topColor: "bg-[var(--status-warning)]",
    headerBg: "bg-[var(--status-warning-bg)] border-transparent",
    emptyText: "Sem pedidos parciais",
    showAvgWait: true,
  },
  {
    status: "PRONTO",
    label: "Prontos",
    topColor: "bg-[var(--status-success)]",
    headerBg: "bg-[var(--status-success-bg)] border-transparent",
    emptyText: "Nenhum pedido pronto",
    showAvgWait: true,
  },
  {
    status: "SAIU_PARA_ENTREGA",
    label: "Saiu p/ Entrega",
    topColor: "bg-blue-500",
    headerBg: "bg-blue-500/10 border-transparent",
    emptyText: "Nenhuma entrega em rota",
    showAvgWait: true,
  },
  {
    status: "ENTREGUE",
    label: "Entregues",
    topColor: "bg-[var(--status-neutral)]",
    headerBg: "bg-[var(--status-neutral-bg)] border-transparent",
    emptyText: "Nenhum entregue ainda",
    showAvgWait: false,
  },
];

const CANCELLED_COLUMN: KanbanColumnConfig = {
  status: "CANCELADO",
  label: "Cancelados",
  topColor: "bg-[var(--status-danger)]",
  headerBg: "bg-[var(--status-danger-bg)] border-transparent",
  emptyText: "Nenhum cancelado",
  showAvgWait: false,
};

function subscribeFocusMode(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(ORDERS_FOCUS_MODE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(ORDERS_FOCUS_MODE_EVENT, callback);
  };
}

function getFocusModeSnapshot() {
  return typeof window !== "undefined" && window.localStorage.getItem(ORDERS_FOCUS_MODE_STORAGE_KEY) === "true";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusEnteredAt(order: Order): string | undefined {
  // Usa sempre queue_entered_at como base — o tempo conta desde que entrou na fila,
  // sem resetar quando o status avança de NA_FILA para PRONTO.
  return order.queue_entered_at ?? order.confirmed_at ?? order.created_at;
}

function getAvgWaitMinutes(orders: Order[], now: number): number | null {
  if (!orders.length) return null;
  const times = orders.map((o) => {
    const since = getStatusEnteredAt(o);
    if (!since) return 0;
    return Math.floor((now - new Date(since).getTime()) / 1000 / 60);
  });
  return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
}

function hasPendingPayment(order: Order) {
  if (order.status === "AGUARDANDO_PAGAMENTO") return true;
  if (order.payment_status === "PENDING" || order.payment_status === "PARTIAL") return true;
  return (order.items ?? []).some(
    (item) => item.status !== "CANCELLED" && item.payment_status !== "PAID" && item.payment_status !== "COURTESY",
  );
}

function isDeliveredPendingPayment(order: Order) {
  return order.status === "ENTREGUE" && hasPendingPayment(order);
}

function isReopenedComanda(order: Order) {
  return Boolean(order.paid_at) && (order.items ?? []).some((item) =>
    item.status !== "CANCELLED"
    && !["PAID", "COURTESY"].includes(item.payment_status)
    && (item.addition_batch_no ?? 1) > 1,
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuickMetric({
  icon: Icon, label, value, detail, tone = "neutral",
}: {
  icon: LucideIcon; label: string; value: string | number; detail: string;
  tone?: "neutral" | "brand" | "success" | "info";
}) {
  const toneClass = {
    neutral: "bg-[var(--bg-subtle)] text-[var(--text-primary)]",
    brand:   "bg-[var(--status-danger-bg)] text-brand-red",
    success: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
    info:    "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  };
  return (
    <div className={`flex h-11 min-w-0 items-center gap-2 rounded-xl px-3 ${toneClass[tone]}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[10px] font-medium opacity-70">{label}</p>
        <p className="truncate text-sm font-semibold">
          {value}
          <span className="ml-1 text-[10px] font-medium opacity-60">{detail}</span>
        </p>
      </div>
    </div>
  );
}

function OrderTab({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold ${
        active
          ? "bg-brand-red text-white shadow-[var(--shadow-sm)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
      }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
          active ? "bg-white/20 text-white" : "bg-[var(--bg-surface)] text-[var(--text-muted)]"
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function AvgWaitBadge({ minutes }: { minutes: number | null }) {
  if (minutes === null) return null;
  const color =
    minutes >= 20 ? "text-[var(--status-danger)]"
    : minutes >= 10 ? "text-[var(--status-warning)]"
    : "text-[var(--status-success)]";
  return (
    <span className={`flex items-center gap-1 text-[10px] font-semibold ${color}`}>
      <Clock className="h-3 w-3" />
      ~{minutes}min
    </span>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  config, orders, now, onCardClick, onQuickAction, onMarkDelivered, onPay, onHandoffChanged, offline, categoryLookup, searchQuery, isLoading,
}: {
  config: KanbanColumnConfig;
  orders: Order[];
  now: number;
  onCardClick: (order: Order) => void;
  onQuickAction: (order: Order) => Promise<void>;
  onMarkDelivered: (order: Order) => Promise<void>;
  onPay: (order: Order) => void;
  onHandoffChanged: (id: string) => void;
  offline: boolean;
  categoryLookup: CategoryLookup;
  searchQuery: string;
  isLoading?: boolean;
}) {
  const filtered = orders
    .filter((order) => orderMatchesSearch(order, searchQuery))
    .sort((a, b) => Number(isReopenedComanda(a)) - Number(isReopenedComanda(b)) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const avgWait = config.showAvgWait ? getAvgWaitMinutes(filtered, now) : null;

  return (
    <div className="flex min-w-[320px] max-w-[360px] flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)]/60">
      {/* Column header — borda superior colorida + fundo suave do status */}
      <div className={`relative shrink-0 px-3 py-2.5 ${config.headerBg}`}>
        <div className={`absolute inset-x-0 top-0 h-1 ${config.topColor}`} />
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {config.label}
            </span>
            <span className="rounded-full bg-[var(--bg-surface)]/80 px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-sm)]">
              {filtered.length}
            </span>
          </div>
          <AvgWaitBadge minutes={avgWait} />
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-thin scrollbar-thumb-zinc-300 scrollbar-track-transparent">
        {isLoading && filtered.length === 0 ? (
          <div className="space-y-2.5">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-2 rounded-full bg-[var(--bg-subtle)] p-3">
              <ShoppingBag className="h-4 w-4 text-[var(--text-muted)]" strokeWidth={1.75} />
            </div>
            <p className="text-xs font-medium text-[var(--text-muted)]">{config.emptyText}</p>
          </div>
        ) : (
          filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              now={now}
              onClick={onCardClick}
              onQuickAction={config.status === "ENTREGUE" || config.status === "CANCELADO" ? undefined : onQuickAction}
              onMarkDelivered={config.status === "NA_FILA" ? onMarkDelivered : undefined}
              onPay={onPay}
            onHandoffChanged={onHandoffChanged}
            handoffOffline={offline}
              categoryLookup={categoryLookup}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PedidosPage() {
  const { currentBranchId } = useBranch();
  return <PedidosWorkspace key={currentBranchId ?? "all-branches"} />;
}

function PedidosWorkspace() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabStatus>("AGORA");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [showCancelled, setShowCancelled] = useState(false);
  const [showOperationalSummary, setShowOperationalSummary] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [orderCategories, setOrderCategories] = useState<CategoryLookup>({});
  const [syncMode, setSyncMode] = useState<"connecting" | "realtime" | "polling" | "offline">("connecting");
  const isFocusMode = useSyncExternalStore(subscribeFocusMode, getFocusModeSnapshot, () => false);
  // md+ = tablet/desktop → use Modal instead of BottomSheet
  const { currentBranch, isLoading: isBranchLoading } = useBranch();
  const currentBranchId = currentBranch?.id ?? null;
  const { toasts, addToast, removeToast } = useToast();

  const selectedOrderRef = useRef<Order | null>(null);
  const ordersRef = useRef<Order[]>([]);
  const incrementalFetchInFlightRef = useRef<Promise<void> | null>(null);
  const pendingOrderIdsRef = useRef<Set<string>>(new Set());
  const pendingSelectedSyncRef = useRef(false);
  const boardRevisionRef = useRef(0);
  const activeBranchIdRef = useRef<string | null | undefined>(currentBranchId);
  const fullFetchInFlightRef = useRef<Promise<void> | null>(null);

  // A key reinicia o estado ao trocar de filial. O cleanup invalida respostas
  // antigas antes que possam publicar dados no quadro que foi desmontado.
  useEffect(() => {
    activeBranchIdRef.current = currentBranchId;
    const pendingIds = pendingOrderIdsRef.current;
    return () => {
      activeBranchIdRef.current = undefined;
      boardRevisionRef.current += 1;
      pendingIds.clear();
    };
  }, [currentBranchId]);

  useEffect(() => { selectedOrderRef.current = selectedOrder; }, [selectedOrder]);
  useEffect(() => { ordersRef.current = orders; }, [orders]);

  useEffect(() => {
    if (isBranchLoading) return;
    let active = true;
    menuApi.getMenuData(currentBranch?.id ?? null)
      .then((menu) => { if (active) setOrderCategories(categoryLookup(menu.categories)); })
      .catch(() => { if (active) setOrderCategories({}); });
    return () => { active = false; };
  }, [currentBranch?.id, isBranchLoading]);

  const toggleFocusMode = useCallback(() => {
    const next = !getFocusModeSnapshot();
    window.localStorage.setItem(ORDERS_FOCUS_MODE_STORAGE_KEY, String(next));
    window.dispatchEvent(new Event(ORDERS_FOCUS_MODE_EVENT));
    if (next) setShowOperationalSummary(false);
  }, []);

  // Limpa o ref imediatamente para evitar race condition com Realtime/polling:
  // sem isso, fetchOrders pode reabrir o modal entre o setState e o useEffect do ref.
  const handleCloseModal = useCallback(() => {
    selectedOrderRef.current = null;
    setSelectedOrder(null);
  }, []);

  // Tick every 30s for timers
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const fetchOrders = useCallback(({
    showLoading = true,
    syncSelectedOrder = false,
  }: {
    showLoading?: boolean;
    syncSelectedOrder?: boolean;
  } = {}): Promise<void> => {
    // Um único carregamento completo por vez: polling, foco e recuperação de
    // conexão podem disparar quase simultaneamente.
    if (fullFetchInFlightRef.current) return fullFetchInFlightRef.current;
    const branchId = currentBranchId;
    const revisionAtStart = boardRevisionRef.current;

    const request = (async () => {
      if (showLoading) setIsLoading(true);
      try {
        const data = await ordersApi.getTodayOrders(branchId);
        // Descartar resposta obsoleta: a filial mudou ou chegou uma atualização
        // incremental mais recente enquanto o carregamento completo aguardava.
        if (activeBranchIdRef.current !== branchId || boardRevisionRef.current !== revisionAtStart) return;
        const nextOrders = data || [];
        const current = selectedOrderRef.current;
        const boardChanged = hasOrderBoardChanged(ordersRef.current, nextOrders);
        boardRevisionRef.current += 1;
        ordersRef.current = nextOrders;
        setOrders(nextOrders);
        const updated = getSelectedOrderSyncCandidate(current, nextOrders, syncSelectedOrder);
        if (updated) setSelectedOrder(updated);
        setError("");
        if (!showLoading && !syncSelectedOrder && current && boardChanged) {
          addToast("success", "Quadro atualizado. O pedido aberto foi preservado.");
        }
      } catch (err) {
        if (activeBranchIdRef.current === branchId) {
          setError(getFriendlyErrorMessage(err, "Não conseguimos carregar os pedidos agora. Tente novamente."));
        }
      } finally {
        if (activeBranchIdRef.current === branchId) setIsLoading(false);
      }
    })();
    fullFetchInFlightRef.current = request;
    void request.finally(() => {
      if (fullFetchInFlightRef.current === request) fullFetchInFlightRef.current = null;
    });
    return request;
  }, [addToast, currentBranchId]);

  // Fila incremental compartilhada por Realtime e pelas ações do operador.
  // Se já existe uma consulta em andamento, novos IDs entram no Set e serão
  // drenados juntos na próxima rodada. Assim nunca existem várias leituras
  // pesadas concorrentes da fila para o mesmo cliente.
  const refreshOrderIds = useCallback(async (
    orderIds: Iterable<string>,
    {
      syncSelectedOrder = false,
    }: {
      syncSelectedOrder?: boolean;
    } = {},
  ) => {
    for (const orderId of orderIds) {
      if (orderId) pendingOrderIdsRef.current.add(orderId);
    }
    if (pendingOrderIdsRef.current.size === 0) return;

    pendingSelectedSyncRef.current = pendingSelectedSyncRef.current || syncSelectedOrder;

    if (incrementalFetchInFlightRef.current) {
      await incrementalFetchInFlightRef.current;
      return;
    }

    const request = (async () => {
      while (pendingOrderIdsRef.current.size > 0) {
        const ids = Array.from(pendingOrderIdsRef.current);
        pendingOrderIdsRef.current.clear();

        const shouldSyncSelected = pendingSelectedSyncRef.current;
        pendingSelectedSyncRef.current = false;

        try {
          const branchId = currentBranchId;
          const refreshedOrders = await ordersApi.getOrdersByIds(ids, branchId);
          if (activeBranchIdRef.current !== branchId) break;
          const currentSelected = selectedOrderRef.current;
          const previousOrders = ordersRef.current;
          const nextOrders = mergeRefreshedOrders(previousOrders, refreshedOrders, ids);
          const boardChanged = hasOrderBoardChanged(previousOrders, nextOrders);

          boardRevisionRef.current += 1;
          ordersRef.current = nextOrders;
          setOrders(nextOrders);

          const updatedSelected = getSelectedOrderSyncCandidate(
            currentSelected,
            nextOrders,
            shouldSyncSelected,
          );
          if (updatedSelected) setSelectedOrder(updatedSelected);

          if (!shouldSyncSelected && currentSelected && boardChanged) {
            addToast("success", "Quadro atualizado. O pedido aberto foi preservado.");
          }
        } catch (err) {
          // Falha de sincronização não transforma uma ação já confirmada no
          // servidor em erro local. Mantém o estado atual e permite o próximo
          // evento/refresh tentar novamente sem criar loop de requisições.
          setError(getFriendlyErrorMessage(err, "Não conseguimos sincronizar os pedidos alterados agora."));
        }
      }
    })();

    incrementalFetchInFlightRef.current = request;
    try {
      await request;
    } finally {
      if (incrementalFetchInFlightRef.current === request) {
        incrementalFetchInFlightRef.current = null;
      }
    }
  }, [addToast, currentBranchId]);

  // O PDV presencial funciona mesmo quando pedidos públicos estão fechados.
  // Realtime antecipa eventos, mas uma consulta periódica recupera eventos
  // perdidos e mudanças de itens (order_items não está na publicação).
  useEffect(() => {
    if (isBranchLoading) return;
    let disposed = false;
    let debounceTimer: number | null = null;
    let realtimeHealthy = false;
    const pendingIds = new Set<string>();
    const initialLoadTimer = window.setTimeout(() => {
      setSyncMode(navigator.onLine === false ? "offline" : "connecting");
      void fetchOrders();
    }, 0);

    const reconcile = () => {
      if (disposed || !shouldReconcileOrderBoard(document.visibilityState, navigator.onLine !== false)) return;
      void fetchOrders({ showLoading: false });
    };

    // Executa mesmo em conexão Realtime "SUBSCRIBED": essa confirmação
    // indica socket conectado, não garante que cada evento foi entregue.
    const reconcileTimer = window.setInterval(reconcile, ORDER_BOARD_RECONCILE_INTERVAL_MS);

    const findOrderIdByItemId = (itemId?: string | null) => {
      if (!itemId) return null;
      for (const order of ordersRef.current) {
        if ((order.items ?? []).some((item) => item.id === itemId)) return order.id;
      }
      return null;
    };

    const scheduleOrderRefresh = (orderId?: string | null) => {
      if (!orderId || disposed) return;
      pendingIds.add(orderId);
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        const ids = Array.from(pendingIds);
        pendingIds.clear();
        void refreshOrderIds(ids);
      }, 400);
    };

    const supabase = createClient();
    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        const nextOrder = payload.new as Partial<Order>;
        const previousOrder = payload.old as Partial<Order>;
        const orderId = nextOrder.id ?? previousOrder.id;
        if (typeof orderId === "string") scheduleOrderRefresh(orderId);
      })
      // Subscription is kept for forward compatibility; the periodic refresh
      // also covers item-only updates until this table is published.
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, (payload) => {
        const nextItem = payload.new as { id?: string; order_id?: string };
        const previousItem = payload.old as { id?: string; order_id?: string };
        const directOrderId = nextItem.order_id ?? previousItem.order_id;
        if (typeof directOrderId === "string") {
          scheduleOrderRefresh(directOrderId);
          return;
        }
        const itemId = nextItem.id ?? previousItem.id;
        if (typeof itemId === "string") scheduleOrderRefresh(findOrderIdByItemId(itemId));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_handoff_units' }, (payload) => {
        const unit = payload.new as { order_id?: string };
        scheduleOrderRefresh(unit.order_id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'printer_jobs' }, (payload) => {
        const job = payload.new as { order_id?: string };
        scheduleOrderRefresh(job.order_id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_handoff_config' }, () => reconcile())
      .subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          realtimeHealthy = true;
          setSyncMode("realtime");
          reconcile(); // Fechar lacuna entre conexão inicial/reconexão e eventos.
        } else if (status === "TIMED_OUT" || status === "CHANNEL_ERROR" || status === "CLOSED") {
          realtimeHealthy = false;
          setSyncMode(navigator.onLine === false ? "offline" : "polling");
          reconcile();
        }
      });

    const onVisibility = () => {
      if (document.visibilityState === "visible") reconcile();
    };
    const onOnline = () => {
      if (disposed) return;
      setSyncMode(realtimeHealthy ? "realtime" : "polling");
      reconcile();
    };
    const onOffline = () => { if (!disposed) setSyncMode("offline"); };
    const onFocus = () => reconcile();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onFocus);

    return () => {
      disposed = true;
      window.clearTimeout(initialLoadTimer);
      window.clearInterval(reconcileTimer);
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      pendingIds.clear();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [fetchOrders, isBranchLoading, refreshOrderIds]);

  // Quick action handler (for card buttons — no modal)
  const handleQuickAction = useCallback(async (order: Order): Promise<void> => {
    if (order.payment_timing === "ON_DELIVERY" && order.status === "AGUARDANDO_CONFIRMACAO") {
      setSelectedOrder(order);
      return;
    }
    if (
      order.status === "PRONTO" && order.type !== "ENTREGA" &&
      !window.confirm(`Confirmar que o pedido #${order.daily_number} foi entregue ao cliente?`)
    ) {
      return;
    }
    const optimisticStatus = order.status === "PRONTO" && order.type === "ENTREGA"
      ? undefined
      : OPTIMISTIC_NEXT_STATUS[order.status];

    if (optimisticStatus) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: optimisticStatus } : o)));
    }

    try {
      if (order.status === "AGUARDANDO_CONFIRMACAO") {
        await pdvApi.confirmOrder(order.id);
      } else if (order.status === "NA_FILA") {
        await pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "PRONTO" });
      } else if (order.status === "PRONTO_PARCIAL") {
        if (order.type === "ENTREGA") {
          setSelectedOrder(order);
          return;
        }
        // Entrega atômica das unidades e itens prontos via batchUpdateProductionStatus:
        const readyUnits = (order.handoffs ?? [])
          .filter((u) => u.prep_status === "READY")
          .map((u) => u.id);
        const readyItemIds = (order.items ?? [])
          .filter((i) => i.status === "READY")
          .map((i) => i.id);
        if (readyUnits.length === 0 && readyItemIds.length === 0) {
          window.alert("Nenhum item pronto pra entregar ainda.");
          return;
        }
        await pdvApi.batchUpdateProductionStatus({
          orderId: order.id,
          unitIds: readyUnits,
          itemIds: readyItemIds,
          newStatus: "DELIVERED",
        });
      } else if (order.status === "PRONTO" && order.type !== "ENTREGA") {
        await pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "ENTREGUE" });
      }
      await refreshOrderIds([order.id]);
    } catch (err) {
      if (optimisticStatus) {
        // Reverte a atualização otimista — o servidor não confirmou a mudança.
        setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: order.status } : o)));
      }
      addToast("error", getFriendlyErrorMessage(err, "Não conseguimos atualizar o status do pedido. Tente novamente."));
    }
  }, [refreshOrderIds, addToast]);

  // Atalho operacional para balcão/viagem: conclui direto da fila, sem passar
  // pelo estado PRONTO. Pedidos de entrega sempre seguem pelo despacho.
  const handleMarkDelivered = useCallback(async (order: Order): Promise<void> => {
    if (!window.confirm(`Confirmar que o pedido #${order.daily_number} foi entregue ao cliente?`)) return;

    setOrders((prev) => prev.map((item) => (item.id === order.id ? { ...item, status: "ENTREGUE" } : item)));
    try {
      await pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "ENTREGUE" });
      await refreshOrderIds([order.id]);
    } catch (err) {
      setOrders((prev) => prev.map((item) => (item.id === order.id ? { ...item, status: order.status } : item)));
      addToast("error", getFriendlyErrorMessage(err, "Não conseguimos marcar o pedido como entregue. Tente novamente."));
    }
  }, [refreshOrderIds, addToast]);

  // Derived counts
  const getCount = (status: OrderStatus) => orders.filter((o) => o.status === status).length;
  const queueCount       = getCount("NA_FILA");
  const readyCount       = getCount("PRONTO");
  const waitingCount     = getCount("AGUARDANDO_CONFIRMACAO");
  const pendingPayCount  = orders.filter((o) =>
    hasPendingPayment(o) && !["CANCELADO", "EXPIRADO"].includes(o.status)
  ).length;
  const actionPriority = (order: Order) => {
    // Acréscimos pagos depois não devem saltar à frente do fluxo que já está
    // em andamento. Continuam visíveis na esteira, porém depois dos pedidos
    // originais que pedem uma ação imediata.
    if (order.status === "PRONTO" || order.status === "PRONTO_PARCIAL") return 0;
    if (order.status === "AGUARDANDO_CONFIRMACAO") return 1;
    if (order.status === "NA_FILA") return 2;
    if (order.status === "SAIU_PARA_ENTREGA") return 3;
    if (isReopenedComanda(order)) return 4;
    if (hasPendingPayment(order)) return 5;
    return 9;
  };

  // A fila inicial é orientada pela próxima responsabilidade, não por um
  // status técnico. Assim pagamentos que precisam ser fechados não somem.
  const filteredOrders = orders
    .filter((order) => {
      const matchesTab = activeTab === "AGORA"
        ? !["ENTREGUE", "CANCELADO", "EXPIRADO"].includes(order.status)
        : activeTab === "PRODUCAO"
        ? ["AGUARDANDO_CONFIRMACAO", "NA_FILA", "PRONTO_PARCIAL"].includes(order.status)
        : activeTab === "ENTREGA"
        ? order.type === "ENTREGA" && ["PRONTO", "SAIU_PARA_ENTREGA"].includes(order.status)
        : activeTab === "CONCLUIDOS"
        ? ["ENTREGUE", "CANCELADO"].includes(order.status)
        : activeTab === "TODOS" ||
        (activeTab === "PAGAMENTO_PENDENTE"
          ? hasPendingPayment(order) && !["CANCELADO", "EXPIRADO"].includes(order.status)
          : activeTab === "ENTREGUE_PENDENTE"
          ? isDeliveredPendingPayment(order)
          : activeTab === "ENTREGUE"
          ? order.status === "ENTREGUE" && !isDeliveredPendingPayment(order)
          : order.status === activeTab);
      const matchesSearch = orderMatchesSearch(order, searchQuery);
      return matchesTab && matchesSearch;
    })
    .sort((a, b) => {
      if (activeTab === "AGORA") {
        const priority = actionPriority(a) - actionPriority(b);
        if (priority !== 0) return priority;
      }
      if (activeTab !== "TODOS") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (isDeliveredPendingPayment(a) !== isDeliveredPendingPayment(b)) {
        return isDeliveredPendingPayment(a) ? -1 : 1;
      }
      const diff = (STATUS_SORT_ORDER[a.status] ?? 99) - (STATUS_SORT_ORDER[b.status] ?? 99);
      return diff !== 0 ? diff : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const partialCount = getCount("PRONTO_PARCIAL");
  const tabs: { id: TabStatus; label: string; count?: number }[] = [
    { id: "AGORA", label: "Agora", count: orders.filter((order) => !["ENTREGUE", "CANCELADO", "EXPIRADO"].includes(order.status)).length },
    { id: "TODOS", label: "Todos", count: orders.length },
    { id: "PRODUCAO", label: "Produção", count: queueCount + waitingCount + partialCount },
    { id: "ENTREGA", label: "Entrega", count: orders.filter((order) => order.type === "ENTREGA" && ["PRONTO", "SAIU_PARA_ENTREGA"].includes(order.status)).length },
    { id: "CONCLUIDOS", label: "Concluídos", count: orders.filter((order) => ["ENTREGUE", "CANCELADO"].includes(order.status)).length },
  ];

  const kanbanColumns = showCancelled
    ? [...KANBAN_COLUMNS, CANCELLED_COLUMN]
    : KANBAN_COLUMNS;

  const desktopSections = kanbanColumns.map((col) => ({
    key: col.status,
    config: col,
    orders: orders.filter((order) => order.status === col.status),
  }));

  // Pagamento é uma dimensão do pedido, não uma segunda posição no quadro.
  // O badge e a ação "Receber" continuam visíveis sem duplicar cartões.
  const visibleDesktopSections = desktopSections;
  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col bg-[var(--bg-base)]">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Shared header ──────────────────────────────────────── */}
      <section className="z-20 border-b border-[var(--border)] bg-[var(--bg-surface)]/95 px-3 py-3 shadow-[var(--shadow-sm)] backdrop-blur md:sticky md:top-14 md:mx-0 md:rounded-2xl md:border md:px-4 md:py-3">

        {/* Busca e ação imediata ficam na primeira dobra; o resumo abre só sob demanda em telas menores. */}
        <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" strokeWidth={1.75} />
            <input
              type="text"
              placeholder="Buscar pedido, cliente, telefone ou endereço..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] pl-10 pr-4 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-brand-red/30 focus:bg-[var(--bg-surface)] focus:outline-none focus:ring-4 focus:ring-brand-red/10"
            />
          </div>

          <button
            type="button"
            onClick={toggleFocusMode}
            aria-pressed={isFocusMode}
            aria-label={isFocusMode ? "Desativar modo de concentração" : "Ativar modo de concentração"}
            title={isFocusMode ? "Desativar modo de concentração" : "Ativar modo de concentração"}
            className={`flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold shadow-[var(--shadow-sm)] active:scale-95 ${
              isFocusMode
                ? "border-brand-red/30 bg-brand-red text-white hover:bg-brand-red/90"
                : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            <FocusIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Foco</span>
          </button>

          <button
            type="button"
            onClick={() => setShowOperationalSummary((visible) => !visible)}
            aria-expanded={showOperationalSummary}
            aria-controls="orders-operational-summary"
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-sm)] hover:bg-[var(--bg-subtle)] active:scale-95 lg:hidden"
          >
            Resumo
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showOperationalSummary ? "rotate-180" : ""}`} />
          </button>

          <button
            onClick={() => fetchOrders()}
            aria-label="Atualizar pedidos"
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-sm)] hover:bg-[var(--bg-subtle)] active:scale-95"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-brand-red" : ""}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        <div
          id="orders-operational-summary"
          className={`${!isFocusMode || showOperationalSummary ? "grid lg:flex" : "hidden"} basis-full grid-cols-2 gap-2 lg:mt-0 lg:basis-auto lg:items-center lg:gap-2 lg:overflow-visible`}
        >
            <QuickMetric icon={CreditCard}  label="A receber" value={pendingPayCount}            detail="pendentes" tone="brand" />
            <QuickMetric icon={Clock}       label="Produção"  value={queueCount + waitingCount}  detail="em preparo" tone="info" />
            <QuickMetric icon={PackageCheck}label="Prontos"  value={readyCount}                 detail="retirada"   tone="success" />
            <QuickMetric icon={ShoppingBag} label="Hoje"     value={orders.length}              detail="pedidos" />

            {/* Indica a condição real da fila, não o horário do checkout online. */}
            <div className={`flex items-center gap-1.5 rounded-xl px-3 h-11 ${
              syncMode === "realtime" ? "bg-[var(--status-success-bg)]" : "bg-[var(--bg-subtle)]"
            }`}>
              <Radio className={`h-3 w-3 ${
                syncMode === "realtime" ? "text-[var(--status-success)] animate-pulse" : "text-[var(--text-muted)]"
              }`} />
              <span className={`text-[11px] font-semibold ${
                syncMode === "realtime" ? "text-[var(--status-success)]" : "text-[var(--text-muted)]"
              }`}>
                {syncMode === "realtime" ? "Ao vivo" : syncMode === "polling" ? "Auto · 20s" : syncMode === "offline" ? "Sem conexão" : "Conectando"}
              </span>
            </div>
        </div>
        </div>

        {/* Tabs — mobile/tablet only */}
        <div className="relative mt-2.5 lg:hidden">
          <div
            role="group"
            aria-label="Filtrar pedidos por status"
            className="flex gap-1.5 overflow-x-auto rounded-full bg-[var(--bg-subtle)] p-1 pr-7 hide-scrollbar"
          >
            {tabs.map((tab) => (
              <OrderTab key={tab.id} active={activeTab === tab.id} label={tab.label} count={tab.count} onClick={() => setActiveTab(tab.id)} />
            ))}
          </div>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-end rounded-r-full bg-gradient-to-l from-[var(--bg-subtle)] via-[var(--bg-subtle)]/90 to-transparent pr-1 text-[var(--text-muted)] md:hidden"
          >
            <ChevronRight className="h-4 w-4" />
          </span>
        </div>

        {/* Desktop Kanban controls */}
        <div className="mt-2.5 hidden items-center justify-end gap-3 lg:flex">
          <button
            onClick={() => setShowCancelled((v) => !v)}
            className={`flex h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${
              showCancelled
                ? "bg-[var(--bg-inverse)] text-white"
                : "border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            {showCancelled ? <EyeOff size={12} /> : <Eye size={12} />}
            Cancelados
          </button>
        </div>
      </section>

      {error && orders.length > 0 && <div role="status" className="mt-3 rounded-xl border border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] p-3 text-sm text-[var(--text-primary)]">Não foi possível atualizar o quadro. Exibindo os últimos dados carregados. {error}</div>}
      <HandoffSettings onChanged={() => { void fetchOrders({ showLoading: false }); }} />

      {/* ── Desktop Kanban (lg+) ─────────────────────────────── */}
      <div
        className="hidden lg:flex gap-4 overflow-x-auto px-0 pb-4 pt-16"
        style={{ height: "calc(100vh - 56px - 148px)" }}
      >
        {visibleDesktopSections.map((section) => (
          <KanbanColumn
            key={section.key}
            config={section.config}
            orders={section.orders}
            now={now}
            onCardClick={setSelectedOrder}
            onQuickAction={handleQuickAction}
            onMarkDelivered={handleMarkDelivered}
            onPay={setPaymentOrder}
            onHandoffChanged={(id) => { void refreshOrderIds([id]); }}
            offline={syncMode === "offline"}
            categoryLookup={orderCategories}
            searchQuery={searchQuery}
            isLoading={isLoading}
          />
        ))}
      </div>

      {/* ── Mobile/Tablet grid (<lg) ─────────────────────────── */}
      <div className="flex-1 pb-6 pt-10 md:pt-12 lg:hidden">
        {isLoading && orders.length === 0 ? (
          <div className="grid grid-cols-1 gap-3 px-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : error && orders.length === 0 ? (
          <div className="mx-3 rounded-2xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] p-4 text-center">
            <p className="text-sm font-semibold text-[var(--status-danger)]">{error}</p>
            <button onClick={() => fetchOrders()} className="mt-2 inline-flex h-11 items-center text-xs font-semibold text-[var(--status-danger)] underline">
              Tentar novamente
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="px-3 py-12">
            <EmptyState
              icon={ClipboardList}
              title={searchQuery ? "Nenhum pedido encontrado" : "Tudo em dia por aqui"}
              description={searchQuery ? "Tente buscar por outro termo." : "Não há pedidos para o status selecionado."}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 pb-24 px-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                now={now}
                onClick={setSelectedOrder}
                onQuickAction={handleQuickAction}
                onMarkDelivered={handleMarkDelivered}
                onPay={setPaymentOrder}
                onHandoffChanged={(id) => { void refreshOrderIds([id]); }}
                handoffOffline={syncMode === "offline"}
                categoryLookup={orderCategories}
              />
            ))}
          </div>
        )}
      </div>

      {/* Um único detalhe responsivo: bottom sheet no mobile e painel amplo no desktop. */}
      <OrderDetailsSheet
        key={selectedOrder?.id ?? "closed"}
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={handleCloseModal}
        onOrderUpdated={async () => {
          if (!selectedOrder) return;
          await refreshOrderIds([selectedOrder.id], { syncSelectedOrder: true });
        }}
        categoryLookup={orderCategories}
      />
      {paymentOrder && (
        <PayItemsModal
          order={paymentOrder}
          onClose={() => setPaymentOrder(null)}
          onPaymentRegistered={() => { void refreshOrderIds([paymentOrder.id]); }}
          onPaid={() => { const orderId = paymentOrder.id; setPaymentOrder(null); void refreshOrderIds([orderId]); }}
        />
      )}
    </div>
  );
}
