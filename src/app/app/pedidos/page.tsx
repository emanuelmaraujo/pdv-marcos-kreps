"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Order, OrderStatus } from "@/types/pdv";
import { ordersApi } from "@/lib/api/orders-api";
import { createClient } from "@/lib/supabase/client";
import { OrderCard } from "./components/OrderCard";
import { OrderDetailsSheet } from "./components/OrderDetailsSheet";
import {
  Clock,
  CreditCard,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

type TabStatus =
  | "TODOS"
  | "AGUARDANDO_CONFIRMACAO"
  | "NA_FILA"
  | "PRONTO"
  | "ENTREGUE"
  | "CANCELADO";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabStatus>("NA_FILA");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const selectedOrderRef = useRef<Order | null>(null);

  useEffect(() => {
    selectedOrderRef.current = selectedOrder;
  }, [selectedOrder]);

  const fetchOrders = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError("");

    try {
      const data = await ordersApi.getTodayOrders();
      setOrders(data || []);

      const current = selectedOrderRef.current;
      if (current) {
        const updated = data.find((order) => order.id === current.id);
        if (updated) setSelectedOrder(updated);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar pedidos");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      fetchOrders();
    }, 0);

    const supabase = createClient();
    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          fetchOrders(false);
        },
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialLoadTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  const getCount = (status: OrderStatus) =>
    orders.filter((order) => order.status === status).length;

  const queueCount = getCount("NA_FILA");
  const readyCount = getCount("PRONTO");
  const waitingCount = getCount("AGUARDANDO_CONFIRMACAO");
  const pendingPaymentCount = orders.filter((order) => order.payment_status === "PENDING").length;
  const receivedTotal = orders
    .filter((order) => order.payment_status === "PAID" || order.payment_status === "COURTESY")
    .reduce((sum, order) => sum + order.total_amount, 0);

  const tabs: { id: TabStatus; label: string; count?: number }[] = [
    { id: "NA_FILA", label: "Na fila", count: queueCount },
    { id: "PRONTO", label: "Prontos", count: readyCount },
    {
      id: "AGUARDANDO_CONFIRMACAO",
      label: "Aguardando",
      count: waitingCount,
    },
    { id: "ENTREGUE", label: "Entregues", count: getCount("ENTREGUE") },
    { id: "CANCELADO", label: "Cancelados", count: getCount("CANCELADO") },
  ];

  const filteredOrders = orders.filter((order) => {
    const normalizedSearch = searchQuery.toLowerCase().trim();
    const matchesTab = activeTab === "TODOS" || order.status === activeTab;
    const matchesSearch =
      !normalizedSearch ||
      String(order.daily_number).includes(normalizedSearch) ||
      order.customer_name?.toLowerCase().includes(normalizedSearch);

    return matchesTab && matchesSearch;
  });

  return (
    <div className="flex min-h-full flex-col bg-[#F5F7FA] px-3 pb-6 pt-0 md:px-6 md:pt-4 lg:px-8">
      <section className="z-20 -mx-3 border-b border-zinc-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur md:sticky md:top-14 md:mx-0 md:rounded-2xl md:border md:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por número ou cliente..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-12 w-full rounded-2xl border border-zinc-100 bg-zinc-100 pl-11 pr-4 text-sm font-bold text-zinc-800 transition-all placeholder:text-zinc-400 focus:border-brand-red/30 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-red/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <QuickMetric icon={ShoppingBag} label="Hoje" value={orders.length} detail="pedidos" />
            <QuickMetric icon={Clock} label="Fila" value={queueCount + waitingCount} detail="em preparo" tone="red" />
            <QuickMetric icon={PackageCheck} label="Prontos" value={readyCount} detail="retirada" tone="emerald" />
            <QuickMetric icon={CreditCard} label="Recebido" value={currency.format(receivedTotal)} detail={`${pendingPaymentCount} pend.`} tone="blue" />
            <button
              onClick={() => fetchOrders()}
              className="col-span-2 inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-xs font-black uppercase text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 active:scale-[0.98] sm:col-span-1"
              aria-label="Atualizar pedidos"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-brand-red" : ""}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto rounded-2xl bg-zinc-100 p-1 hide-scrollbar">
          <OrderTab
            active={activeTab === "TODOS"}
            label="Todos"
            count={orders.length}
            onClick={() => setActiveTab("TODOS")}
          />
          {tabs.map((tab) => (
            <OrderTab
              key={tab.id}
              active={activeTab === tab.id}
              label={tab.label}
              count={tab.count}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>
      </section>

      <div className="flex-1 overflow-y-auto py-4 md:py-6">
        {isLoading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-zinc-400">
            <RefreshCw size={32} className="animate-spin text-brand-red" />
            <p className="text-sm font-bold uppercase tracking-widest">
              Sincronizando pedidos...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-sm font-bold text-red-700">{error}</p>
            <button
              onClick={() => fetchOrders()}
              className="mt-2 text-xs font-black uppercase tracking-widest text-red-500"
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-12">
            <EmptyState
              title={searchQuery ? "Nenhum resultado" : "Tudo limpo por aqui"}
              description={
                searchQuery
                  ? "Tente buscar por outro termo."
                  : "Não há pedidos para o status selecionado."
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 pb-24 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={(item) => setSelectedOrder(item)}
              />
            ))}
          </div>
        )}
      </div>

      <OrderDetailsSheet
        key={selectedOrder?.id ?? "closed"}
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onOrderUpdated={() => fetchOrders(false)}
      />
    </div>
  );
}

function QuickMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone = "zinc",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  tone?: "zinc" | "red" | "emerald" | "blue";
}) {
  const toneClass = {
    zinc: "bg-zinc-50 text-zinc-700",
    red: "bg-red-50 text-brand-red",
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
  };

  return (
    <div className={`flex h-12 min-w-0 items-center gap-2 rounded-2xl px-3 ${toneClass[tone]}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[10px] font-black uppercase tracking-wide opacity-70">{label}</p>
        <p className="truncate text-sm font-black">
          {value}
          <span className="ml-1 text-[10px] font-bold opacity-60">{detail}</span>
        </p>
      </div>
    </div>
  );
}

function OrderTab({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-xs font-black uppercase tracking-wide transition-all ${
        active
          ? "bg-brand-red text-white shadow-sm"
          : "text-zinc-500 hover:bg-white hover:text-zinc-700"
      }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`rounded-lg px-1.5 py-0.5 text-[10px] ${
            active ? "bg-white/20 text-white" : "bg-white text-zinc-500"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
