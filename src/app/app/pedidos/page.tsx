"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Order, OrderStatus } from "@/types/pdv";
import { ordersApi } from "@/lib/api/orders-api";
import { pdvApi } from "@/lib/api/pdv-api";
import { createClient } from "@/lib/supabase/client";
import { OrderCard } from "./components/OrderCard";
import { OrderDetailsSheet } from "./components/OrderDetailsSheet";
import { OrderDetailsModal } from "./components/OrderDetailsModal";
import {
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
  | "AGUARDANDO_CONFIRMACAO"
  | "NA_FILA"
  | "PRONTO"
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
  PRONTO: 3,
  ENTREGUE: 4,
  CANCELADO: 5,
  EXPIRADO: 6,
};

const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    status: "AGUARDANDO_CONFIRMACAO",
    label: "Aguardando",
    topColor: "bg-blue-500",
    headerBg: "bg-blue-50 border-blue-100",
    emptyText: "Sem pedidos aguardando",
    showAvgWait: true,
  },
  {
    status: "NA_FILA",
    label: "Na Fila",
    topColor: "bg-brand-red",
    headerBg: "bg-red-50 border-red-100",
    emptyText: "Fila vazia",
    showAvgWait: true,
  },
  {
    status: "PRONTO",
    label: "Prontos",
    topColor: "bg-brand-amber",
    headerBg: "bg-amber-50 border-amber-100",
    emptyText: "Nenhum pedido pronto",
    showAvgWait: true,
  },
  {
    status: "ENTREGUE",
    label: "Entregues",
    topColor: "bg-emerald-500",
    headerBg: "bg-emerald-50 border-emerald-100",
    emptyText: "Nenhum entregue ainda",
    showAvgWait: false,
  },
];

const CANCELLED_COLUMN: KanbanColumnConfig = {
  status: "CANCELADO",
  label: "Cancelados",
  topColor: "bg-zinc-400",
  headerBg: "bg-zinc-100 border-zinc-200",
  emptyText: "Nenhum cancelado",
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
  switch (order.status) {
    case "NA_FILA":   return order.queue_entered_at ?? order.confirmed_at;
    case "PRONTO":    return order.ready_at;
    default:          return order.created_at;
  }
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuickMetric({
  icon: Icon, label, value, detail, tone = "zinc",
}: {
  icon: LucideIcon; label: string; value: string | number; detail: string; tone?: "zinc" | "red" | "emerald" | "blue";
}) {
  const toneClass = {
    zinc:    "bg-zinc-50 text-zinc-700",
    red:     "bg-red-50 text-brand-red",
    emerald: "bg-emerald-50 text-emerald-700",
    blue:    "bg-blue-50 text-blue-700",
  };
  return (
    <div className={`flex h-11 min-w-0 items-center gap-2 rounded-xl px-3 ${toneClass[tone]}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[9px] font-black uppercase tracking-wide opacity-70">{label}</p>
        <p className="truncate text-sm font-black">
          {value}
          <span className="ml-1 text-[9px] font-bold opacity-60">{detail}</span>
        </p>
      </div>
    </div>
  );
}

function OrderTab({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-[11px] font-black uppercase tracking-wide transition-all ${
        active ? "bg-brand-red text-white shadow-sm" : "text-zinc-500 hover:bg-white hover:text-zinc-700"
      }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20 text-white" : "bg-white text-zinc-500"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function AvgWaitBadge({ minutes }: { minutes: number | null }) {
  if (minutes === null) return null;
  const color = minutes >= 20 ? "text-red-600" : minutes >= 10 ? "text-amber-600" : "text-emerald-600";
  return (
    <span className={`flex items-center gap-1 text-[10px] font-black ${color}`}>
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
    <div className="flex min-w-[260px] max-w-[320px] flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100/60">
      {/* Column header */}
      <div className={`shrink-0 border-b px-3 py-2.5 ${config.headerBg}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${config.topColor}`} />
            <span className="text-xs font-black uppercase tracking-widest text-zinc-700">
              {config.label}
            </span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-black text-zinc-600 shadow-sm">
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
            <div className="mb-2 rounded-full bg-zinc-200 p-3">
              <ShoppingBag className="h-4 w-4 text-zinc-400" />
            </div>
            <p className="text-[11px] font-bold text-zinc-400">{config.emptyText}</p>
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
      const data = await ordersApi.getTodayOrders();
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
  }, []);

  // Initial load + realtime
  useEffect(() => {
    const timer = window.setTimeout(() => fetchOrders(), 0);
    const supabase = createClient();
    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
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
    } else if (order.status === "PRONTO") {
      if (
        order.payment_status === "PENDING" &&
        !window.confirm("ATENÇÃO: Pagamento PENDENTE. Confirmar entrega mesmo assim?")
      ) return;
      await pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "ENTREGUE" });
    }
    await fetchOrders(false);
  }, [fetchOrders]);

  // Derived counts
  const getCount = (status: OrderStatus) => orders.filter((o) => o.status === status).length;
  const queueCount       = getCount("NA_FILA");
  const readyCount       = getCount("PRONTO");
  const waitingCount     = getCount("AGUARDANDO_CONFIRMACAO");
  const pendingPayCount  = orders.filter((o) => o.payment_status === "PENDING").length;
  const receivedTotal    = orders
    .filter((o) => o.payment_status === "PAID" || o.payment_status === "COURTESY")
    .reduce((sum, o) => sum + o.total_amount, 0);

  // Mobile/tablet filtered + sorted orders
  const filteredOrders = orders
    .filter((order) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesTab = activeTab === "TODOS" ||
        order.status === activeTab;
      const matchesSearch =
        !q || String(order.daily_number).includes(q) || order.customer_name?.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    })
    .sort((a, b) => {
      if (activeTab !== "TODOS") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      const diff = (STATUS_SORT_ORDER[a.status] ?? 99) - (STATUS_SORT_ORDER[b.status] ?? 99);
      return diff !== 0 ? diff : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const tabs: { id: TabStatus; label: string; count?: number }[] = [
    { id: "NA_FILA",               label: "Na fila",    count: queueCount },
    { id: "PRONTO",                label: "Prontos",    count: readyCount },
    { id: "AGUARDANDO_CONFIRMACAO",label: "Aguardando", count: waitingCount },
    { id: "ENTREGUE",              label: "Entregues",  count: getCount("ENTREGUE") },
    { id: "CANCELADO",             label: "Cancelados", count: getCount("CANCELADO") },
  ];

  const kanbanColumns = showCancelled
    ? [...KANBAN_COLUMNS, CANCELLED_COLUMN]
    : KANBAN_COLUMNS;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col bg-[#F5F7FA]">

      {/* ── Shared header ──────────────────────────────────────── */}
      <section className="z-20 -mx-3 border-b border-zinc-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur md:sticky md:top-14 md:mx-0 md:rounded-2xl md:border md:px-4 md:py-3">

        {/* Search + metrics row */}
        <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar número ou cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-100 bg-zinc-100 pl-10 pr-4 text-sm font-bold text-zinc-800 transition-all placeholder:text-zinc-400 focus:border-brand-red/30 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-red/10"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <QuickMetric icon={ShoppingBag} label="Hoje"     value={orders.length}              detail="pedidos" />
            <QuickMetric icon={Clock}       label="Fila"     value={queueCount + waitingCount}  detail="em preparo" tone="red" />
            <QuickMetric icon={PackageCheck}label="Prontos"  value={readyCount}                 detail="retirada"   tone="emerald" />
            <QuickMetric icon={CreditCard}  label="Recebido" value={currency.format(receivedTotal)} detail={`${pendingPayCount} pend.`} tone="blue" />

            {/* Live badge */}
            <div className="hidden md:flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 h-11 border border-emerald-100">
              <Radio className={`h-3 w-3 text-emerald-500 ${!isLoading ? "animate-pulse" : ""}`} />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Ao vivo</span>
            </div>

            <button
              onClick={() => fetchOrders()}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-[11px] font-black uppercase text-zinc-600 shadow-sm transition-all hover:bg-zinc-50 active:scale-95"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-brand-red" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>

        {/* Tabs — mobile/tablet only */}
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto rounded-xl bg-zinc-100 p-1 hide-scrollbar lg:hidden">
          <OrderTab active={activeTab === "TODOS"} label="Todos" count={orders.length} onClick={() => setActiveTab("TODOS")} />
          {tabs.map((tab) => (
            <OrderTab key={tab.id} active={activeTab === tab.id} label={tab.label} count={tab.count} onClick={() => setActiveTab(tab.id)} />
          ))}
        </div>

        {/* Desktop Kanban controls */}
        <div className="mt-2.5 hidden items-center justify-end gap-3 lg:flex">
          <button
            onClick={() => setShowCancelled((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition-all ${
              showCancelled
                ? "bg-zinc-700 text-white"
                : "border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
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
        {kanbanColumns.map((col) => (
          <KanbanColumn
            key={col.status}
            config={col}
            orders={orders.filter((o) => o.status === col.status)}
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
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-zinc-400 mx-3">
            <RefreshCw size={28} className="animate-spin text-brand-red" />
            <p className="text-sm font-bold uppercase tracking-widest">Sincronizando pedidos...</p>
          </div>
        ) : error ? (
          <div className="mx-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-sm font-bold text-red-700">{error}</p>
            <button onClick={() => fetchOrders()} className="mt-2 text-xs font-black uppercase tracking-widest text-red-500">
              Tentar novamente
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-12">
            <EmptyState
              title={searchQuery ? "Nenhum resultado" : "Tudo limpo por aqui"}
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
