"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Order, OrderStatus } from "@/types/pdv";
import { ordersApi } from "@/lib/api/orders-api";
import { createClient } from "@/lib/supabase/client";
import { OrderCard } from "./components/OrderCard";
import { OrderDetailsSheet } from "./components/OrderDetailsSheet";
import { RefreshCw, Search } from "lucide-react";

type TabStatus = "TODOS" | "AGUARDANDO_CONFIRMACAO" | "NA_FILA" | "PRONTO" | "ENTREGUE" | "CANCELADO";

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabStatus>("NA_FILA");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Keep a ref to selectedOrder so the realtime callback can access the latest value
  // without capturing a stale closure.
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

      // Keep the open detail-sheet in sync
      const current = selectedOrderRef.current;
      if (current) {
        const updated = data.find((o) => o.id === current.id);
        if (updated) setSelectedOrder(updated);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar pedidos");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load
    const initialLoadTimer = window.setTimeout(() => {
      fetchOrders();
    }, 0);

    // ── Supabase Realtime ─────────────────────────────────────────────────────
    // Subscribe to INSERT / UPDATE on the orders table.
    // We re-fetch the full page rather than merging partial payloads so we always
    // have consistent nested data (order_items, addons, etc.).
    const supabase = createClient();

    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",        // INSERT, UPDATE, DELETE
          schema: "public",
          table: "orders",
        },
        () => {
          // Debounce: if multiple rows change in quick succession we only refetch once.
          fetchOrders(false);
        },
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialLoadTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  const filteredOrders = orders.filter((o) => {
    const matchesTab = activeTab === "TODOS" || o.status === activeTab;
    const matchesSearch =
      !searchQuery ||
      String(o.daily_number).includes(searchQuery) ||
      o.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getCount = (status: OrderStatus) =>
    orders.filter((o) => o.status === status).length;

  const tabs: { id: TabStatus; label: string; count?: number }[] = [
    { id: "NA_FILA", label: "Na Fila", count: getCount("NA_FILA") },
    { id: "PRONTO", label: "Prontos", count: getCount("PRONTO") },
    {
      id: "AGUARDANDO_CONFIRMACAO",
      label: "Aguardando",
      count: getCount("AGUARDANDO_CONFIRMACAO"),
    },
    { id: "ENTREGUE", label: "Entregues", count: getCount("ENTREGUE") },
    { id: "CANCELADO", label: "Cancelados", count: getCount("CANCELADO") },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F4F4F5]">
      {/* Search & Tabs */}
      <div className="sticky top-14 z-20 border-b border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:px-6">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              placeholder="Buscar por número ou cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-100 bg-zinc-100 py-2.5 pl-10 pr-4 text-sm font-bold transition-all placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-red"
            />
          </div>
          <button
            onClick={() => fetchOrders()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-600 transition-all hover:bg-zinc-50 active:scale-[0.98]"
            aria-label="Atualizar pedidos"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            <span>Atualizar</span>
          </button>
        </div>

        <div className="flex space-x-2 overflow-x-auto px-4 pb-4 md:px-6 hide-scrollbar">
          <button
            onClick={() => setActiveTab("TODOS")}
            className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all ${
              activeTab === "TODOS"
                ? "bg-brand-charcoal text-white"
                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
            }`}
          >
            TODOS ({orders.length})
          </button>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all flex items-center space-x-2 ${
                activeTab === tab.id
                  ? "bg-brand-red text-white shadow-md shadow-brand-red/20"
                  : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                    activeTab === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-zinc-200 text-zinc-600"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
        {isLoading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-zinc-400 space-y-4">
            <RefreshCw size={32} className="animate-spin text-brand-red" />
            <p className="text-sm font-bold uppercase tracking-widest">
              Sincronizando Pedidos...
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-center">
            <p className="text-red-700 text-sm font-bold">⚠️ {error}</p>
            <button
              onClick={() => fetchOrders()}
              className="mt-2 text-xs font-black text-red-500 uppercase tracking-widest"
            >
              Tentar Novamente
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-24">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={(o) => setSelectedOrder(o)}
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
