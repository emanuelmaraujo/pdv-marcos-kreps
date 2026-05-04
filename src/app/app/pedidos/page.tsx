"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Order, OrderStatus } from "@/types/pdv";
import { ordersApi } from "@/lib/api/orders-api";
import { OrderCard } from "./components/OrderCard";
import { OrderDetailsSheet } from "./components/OrderDetailsSheet";

type TabStatus = "TODOS" | "AGUARDANDO_CONFIRMACAO" | "NA_FILA" | "PRONTO" | "ENTREGUE" | "CANCELADO";

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabStatus>("NA_FILA");
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await ordersApi.getTodayOrders();
      setOrders(data || []);
      
      // Update selected order if it's currently open
      if (selectedOrder) {
        const updatedOrder = data.find(o => o.id === selectedOrder.id);
        if (updatedOrder) {
          setSelectedOrder(updatedOrder);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erro ao carregar pedidos");
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrder]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const data = await ordersApi.getTodayOrders();
        if (!cancelled) {
          setOrders(data || []);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          if (err instanceof Error) {
            setError(err.message);
          } else {
            setError("Erro ao carregar pedidos");
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Initial load only; fetchOrders is used for manual refresh
  }, []);

  const filteredOrders = orders.filter((o) => {
    if (activeTab === "TODOS") return true;
    return o.status === activeTab;
  });

  const getCount = (status: OrderStatus) => orders.filter(o => o.status === status).length;

  const tabs: { id: TabStatus; label: string }[] = [
    { id: "AGUARDANDO_CONFIRMACAO", label: `Aguardando (${getCount('AGUARDANDO_CONFIRMACAO')})` },
    { id: "NA_FILA", label: `Na Fila (${getCount('NA_FILA')})` },
    { id: "PRONTO", label: `Prontos (${getCount('PRONTO')})` },
    { id: "ENTREGUE", label: `Entregues (${getCount('ENTREGUE')})` },
    { id: "CANCELADO", label: `Cancelados (${getCount('CANCELADO')})` },
  ];

  return (
    <div className="flex flex-col h-full bg-muted/10">
      <PageHeader title="Pedidos do Dia" />
      
      <div className="flex space-x-2 p-4 overflow-x-auto border-b border-border hide-scrollbar bg-white">
        {tabs.map(tab => (
          <Badge 
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "outline"} 
            className="whitespace-nowrap cursor-pointer text-sm py-1.5 px-3"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Badge>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {isLoading && orders.length === 0 ? (
          <div className="flex justify-center p-8 text-muted-foreground text-sm">Carregando pedidos...</div>
        ) : error ? (
          <div className="text-red-500 text-center p-4 bg-red-50 rounded-md border border-red-200 text-sm font-medium">{error}</div>
        ) : filteredOrders.length === 0 ? (
          <EmptyState 
            title="Nenhum pedido aqui" 
            description="Não há pedidos para o status selecionado."
          />
        ) : (
          <div className="space-y-3 pb-20">
            {filteredOrders.map(order => (
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
        onOrderUpdated={fetchOrders}
      />
    </div>
  );
}
