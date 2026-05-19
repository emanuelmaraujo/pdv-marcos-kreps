"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Order, OrderStatus } from "@/types/pdv";
import { ordersApi } from "@/lib/api/orders-api";
import { pdvApi } from "@/lib/api/pdv-api";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/contexts/BranchContext";
import { OrderCard } from "./components/OrderCard";
import { OrderDetailsSheet } from "./components/OrderDetailsSheet";
import { OrderDetailsModal } from "./components/OrderDetailsModal";
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
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabStatus =
  | "TODOS"
  | "PAGAMENTO_PENDENTE"
  | "AGUARDANDO_CONFIRMACAO"
  | "NA_FILA"
  | "PRONTO_PARCIAL"
  | "PRONTO"
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

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_SORT_ORDER: Record<OrderStatus, number> = {
  NA_FILA: 0,
  AGUARDANDO_CONFIRMACAO: 1,
  AGUARDANDO_PAGAMENTO: 2,
  PRONTO_PARCIAL: 3,
  PRONTO: 4,
  ENTREGUE: 5,
  CANCELADO: 6,
  EXPIRADO: 7,
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

const DELIVERED_PENDING_COLUMN: KanbanColumnConfig = {
  status: "ENTREGUE",
  label: "Entregues com pagamento pendente",
  topColor: "bg-[var(--status-warning)]",
  headerBg: "bg-[var(--status-warning-bg)] border-transparent",
  emptyText: "Nenhum entregue pendente",
  showAvgWait: false,
};

const PAYMENT_PENDING_COLUMN: KanbanColumnConfig = {
  status: "AGUARDANDO_PAGAMENTO",
  label: "Aguardando pagamento",
  topColor: "bg-[var(--status-warning)]",
  headerBg: "bg-[var(--status-warning-bg)] border-transparent",
  emptyText: "Nenhum pagamento pendente",
  showAvgWait: false,
};

function subscribeMdPlus(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mediaQuery = window.matchMedia("(min-width: 768px)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getMdPlusSnapshot() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
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
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold ${
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
  config, orders, now, onCardClick, onQuickAction, searchQuery,
}: {
  config: KanbanColumnConfig;
  orders: Order[];
  now: number;
  onCardClick: (order: Order) => void;
  onQuickAction: (order: Order) => Promise<void>;
  searchQuery: string;
}) {
  const filtered = orders
    .filter((o) => {
      const q = searchQuery.toLowerCase().trim();
      return !q || String(o.daily_number).includes(q) || o.customer_name?.toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const avgWait = config.showAvgWait ? getAvgWaitMinutes(filtered, now) : null;

  return (
    <div className="flex min-w-[260px] max-w-[320px] flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)]/60">
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
        {filtered.length === 0 ? (
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
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabStatus>("NA_FILA");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [showCancelled, setShowCancelled] = useState(false);
  // md+ = tablet/desktop → use Modal instead of BottomSheet
  const isMdPlus = useSyncExternalStore(subscribeMdPlus, getMdPlusSnapshot, () => false);
  const { currentBranch } = useBranch();

  const selectedOrderRef = useRef<Order | null>(null);

  useEffect(() => { selectedOrderRef.current = selectedOrder; }, [selectedOrder]);

  // Tick every 30s for timers
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const fetchOrders = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError("");
    try {
      const data = await ordersApi.getTodayOrders(currentBranch?.id ?? null);
      setOrders(data || []);
      const current = selectedOrderRef.current;
      if (current) {
        const updated = data.find((o) => o.id === current.id);
        if (updated) setSelectedOrder(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar pedidos");
    } finally {
      setIsLoading(false);
    }
  }, [currentBranch]);

  // Initial load + realtime. Refaz quando filial selecionada muda.
  useEffect(() => {
    const timer = window.setTimeout(() => fetchOrders(), 0);
    const supabase = createClient();
    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchOrders(false);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "order_items" }, () => {
        fetchOrders(false);
      })
      .subscribe();
    return () => { window.clearTimeout(timer); supabase.removeChannel(channel); };
  }, [fetchOrders]);

  // Quick action handler (for card buttons — no modal)
  const handleQuickAction = useCallback(async (order: Order): Promise<void> => {
    if (order.status === "AGUARDANDO_CONFIRMACAO") {
      await pdvApi.confirmOrder(order.id);
    } else if (order.status === "NA_FILA") {
      await pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "PRONTO" });
    } else if (order.status === "PRONTO_PARCIAL") {
      // Entrega só os itens prontos. O trigger derivará o status do pedido.
      const readyItemIds = (order.items ?? [])
        .filter((i) => i.status === "READY")
        .map((i) => i.id);
      if (readyItemIds.length === 0) {
        window.alert("Nenhum item pronto pra entregar ainda.");
        return;
      }
      for (const id of readyItemIds) {
        await pdvApi.updateOrderItemStatus({ orderItemId: id, newStatus: "DELIVERED" });
      }
    } else if (order.status === "PRONTO") {
      await pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "ENTREGUE" });
    }
    await fetchOrders(false);
  }, [fetchOrders]);

  // Derived counts
  const getCount = (status: OrderStatus) => orders.filter((o) => o.status === status).length;
  const queueCount       = getCount("NA_FILA");
  const readyCount       = getCount("PRONTO");
  const waitingCount     = getCount("AGUARDANDO_CONFIRMACAO");
  const deliveredPendingCount = orders.filter(isDeliveredPendingPayment).length;
  const pendingPayCount  = orders.filter((o) =>
    hasPendingPayment(o) && !["CANCELADO", "EXPIRADO"].includes(o.status)
  ).length;
  const receivedTotal    = orders
    .filter((o) => o.payment_status === "PAID" || o.payment_status === "COURTESY")
    .reduce((sum, o) => sum + o.total_amount, 0);

  // Mobile/tablet filtered + sorted orders
  const filteredOrders = orders
    .filter((order) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesTab = activeTab === "TODOS" ||
        (activeTab === "PAGAMENTO_PENDENTE"
          ? hasPendingPayment(order) && !["CANCELADO", "EXPIRADO"].includes(order.status)
          : activeTab === "ENTREGUE_PENDENTE"
          ? isDeliveredPendingPayment(order)
          : activeTab === "ENTREGUE"
          ? order.status === "ENTREGUE" && !isDeliveredPendingPayment(order)
          : order.status === activeTab);
      const matchesSearch =
        !q || String(order.daily_number).includes(q) || order.customer_name?.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    })
    .sort((a, b) => {
      if (activeTab !== "TODOS") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (isDeliveredPendingPayment(a) !== isDeliveredPendingPayment(b)) {
        return isDeliveredPendingPayment(a) ? -1 : 1;
      }
      const diff = (STATUS_SORT_ORDER[a.status] ?? 99) - (STATUS_SORT_ORDER[b.status] ?? 99);
      return diff !== 0 ? diff : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const partialCount = getCount("PRONTO_PARCIAL");
  const tabs: { id: TabStatus; label: string; count?: number }[] = [
    { id: "PAGAMENTO_PENDENTE",    label: "Ag. pagto",  count: pendingPayCount },
    { id: "NA_FILA",               label: "Na fila",    count: queueCount },
    { id: "PRONTO_PARCIAL",        label: "Parciais",   count: partialCount },
    { id: "PRONTO",                label: "Prontos",    count: readyCount },
    { id: "ENTREGUE_PENDENTE",     label: "Pend. pagto", count: deliveredPendingCount },
    { id: "AGUARDANDO_CONFIRMACAO",label: "Aguardando", count: waitingCount },
    { id: "ENTREGUE",              label: "Entregues",  count: orders.filter((o) => o.status === "ENTREGUE" && !isDeliveredPendingPayment(o)).length },
    { id: "CANCELADO",             label: "Cancelados", count: getCount("CANCELADO") },
  ];

  const kanbanColumns = showCancelled
    ? [...KANBAN_COLUMNS, CANCELLED_COLUMN]
    : KANBAN_COLUMNS;

  const desktopSections = kanbanColumns.flatMap((col) => {
    if (col.status !== "ENTREGUE") {
      return [{ key: col.status, config: col, orders: orders.filter((o) => o.status === col.status) }];
    }
    return [
      { key: "ENTREGUE_PENDENTE", config: DELIVERED_PENDING_COLUMN, orders: orders.filter(isDeliveredPendingPayment) },
      { key: "ENTREGUE", config: col, orders: orders.filter((o) => o.status === "ENTREGUE" && !isDeliveredPendingPayment(o)) },
    ];
  });

  const visibleDesktopSections = [
    {
      key: "PAGAMENTO_PENDENTE",
      config: PAYMENT_PENDING_COLUMN,
      orders: orders.filter((o) => hasPendingPayment(o) && !["CANCELADO", "EXPIRADO"].includes(o.status)),
    },
    ...desktopSections,
  ];

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col bg-[var(--bg-base)]">

      {/* ── Shared header ──────────────────────────────────────── */}
      <section className="z-20 -mx-3 border-b border-[var(--border)] bg-[var(--bg-surface)]/95 px-3 py-3 shadow-[var(--shadow-sm)] backdrop-blur md:sticky md:top-14 md:mx-0 md:rounded-2xl md:border md:px-4 md:py-3">

        {/* Search + metrics row */}
        <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" strokeWidth={1.75} />
            <input
              type="text"
              placeholder="Buscar número ou cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] pl-10 pr-4 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-brand-red/30 focus:bg-[var(--bg-surface)] focus:outline-none focus:ring-4 focus:ring-brand-red/10"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <QuickMetric icon={ShoppingBag} label="Hoje"     value={orders.length}              detail="pedidos" />
            <QuickMetric icon={Clock}       label="Fila"     value={queueCount + waitingCount}  detail="em preparo" tone="brand" />
            <QuickMetric icon={PackageCheck}label="Prontos"  value={readyCount}                 detail="retirada"   tone="success" />
            <QuickMetric icon={CreditCard}  label="Recebido" value={currency.format(receivedTotal)} detail={`${pendingPayCount} pend.`} tone="info" />

            {/* Live badge */}
            <div className="hidden md:flex items-center gap-1.5 rounded-xl bg-[var(--status-success-bg)] px-3 h-11">
              <Radio className={`h-3 w-3 text-[var(--status-success)] ${!isLoading ? "animate-pulse" : ""}`} />
              <span className="text-[11px] font-semibold text-[var(--status-success)]">Ao vivo</span>
            </div>

            <button
              onClick={() => fetchOrders()}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-sm)] hover:bg-[var(--bg-subtle)] active:scale-95"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-brand-red" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>

        {/* Tabs — mobile/tablet only */}
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto rounded-full bg-[var(--bg-subtle)] p-1 hide-scrollbar lg:hidden">
          <OrderTab active={activeTab === "TODOS"} label="Todos" count={orders.length} onClick={() => setActiveTab("TODOS")} />
          {tabs.map((tab) => (
            <OrderTab key={tab.id} active={activeTab === tab.id} label={tab.label} count={tab.count} onClick={() => setActiveTab(tab.id)} />
          ))}
        </div>

        {/* Desktop Kanban controls */}
        <div className="mt-2.5 hidden items-center justify-end gap-3 lg:flex">
          <button
            onClick={() => setShowCancelled((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
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
            searchQuery={searchQuery}
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
        ) : error ? (
          <div className="mx-3 rounded-2xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] p-4 text-center">
            <p className="text-sm font-semibold text-[var(--status-danger)]">{error}</p>
            <button onClick={() => fetchOrders()} className="mt-2 text-xs font-semibold text-[var(--status-danger)] underline">
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
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modal (tablet/desktop) ─────────────────────────────── */}
      {isMdPlus && (
        <OrderDetailsModal
          key={selectedOrder?.id ?? "closed"}
          order={selectedOrder}
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOrderUpdated={() => fetchOrders(false)}
        />
      )}

      {/* ── BottomSheet (mobile) ───────────────────────────────── */}
      {!isMdPlus && (
        <OrderDetailsSheet
          key={selectedOrder?.id ?? "closed"}
          order={selectedOrder}
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOrderUpdated={() => fetchOrders(false)}
        />
      )}
    </div>
  );
}
