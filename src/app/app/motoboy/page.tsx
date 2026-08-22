"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, CheckCircle2, MapPin, MessageCircle, Navigation, Phone, RefreshCw } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { createClient } from "@/lib/supabase/client";
import { pdvApi } from "@/lib/api/pdv-api";
import { Order } from "@/types/pdv";
import { mapsUrlForAddress, mapsUrlForCoordinates } from "@/lib/utils/geolocation";
import { whatsappUrlForPhone } from "@/lib/utils/whatsapp";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/feedback/LoadingState";
import { EmptyState } from "@/components/feedback/EmptyState";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatTime(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fullAddress(order: Order) {
  const parts = [
    order.delivery_street,
    order.delivery_number,
    order.delivery_complement,
    order.delivery_neighborhood,
  ].filter(Boolean);
  return parts.join(", ");
}

function mapsUrlForOrder(order: Order): string | null {
  if (order.delivery_latitude != null && order.delivery_longitude != null) {
    return mapsUrlForCoordinates(order.delivery_latitude, order.delivery_longitude);
  }
  const address = fullAddress(order);
  return address ? mapsUrlForAddress(address) : null;
}

export default function MotoboyPage() {
  const { user, isLoading: userLoading, isCourier } = useUser();
  const router = useRouter();
  const supabase = createClient();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userLoading && !isCourier) router.replace("/app");
  }, [userLoading, isCourier, router]);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const { data: courier, error: courierErr } = await supabase
        .from("couriers")
        .select("id")
        .eq("profile_id", user.id)
        .single();
      if (courierErr || !courier) throw new Error("Cadastro de entregador não encontrado.");

      const { data, error: ordersErr } = await supabase
        .from("orders")
        .select("*")
        .eq("courier_id", courier.id)
        .in("status", ["SAIU_PARA_ENTREGA", "ENTREGUE"])
        .order("dispatched_at", { ascending: false })
        .limit(50);
      if (ordersErr) throw ordersErr;
      setOrders((data ?? []) as Order[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar entregas.");
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (!isCourier) return;
    const timer = window.setTimeout(() => void loadOrders(), 0);
    return () => window.clearTimeout(timer);
  }, [isCourier, loadOrders]);

  const handleConfirmDelivery = async (orderId: string) => {
    setConfirmingId(orderId);
    setError("");
    try {
      await pdvApi.confirmDelivery({ orderId });
      await loadOrders();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao confirmar entrega.");
    } finally {
      setConfirmingId(null);
    }
  };

  if (userLoading || !isCourier) {
    return <LoadingState message="Carregando..." />;
  }

  const pending = orders.filter((o) => o.status === "SAIU_PARA_ENTREGA");
  const delivered = orders.filter((o) => o.status === "ENTREGUE");

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            <Bike className="h-6 w-6 text-brand-red" />
            Minhas Entregas
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {user?.name ? `Olá, ${user.name.split(" ")[0]}` : "Pedidos despachados para você"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadOrders()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-[var(--status-danger)] bg-[var(--status-danger-bg)] p-3 text-sm text-[var(--status-danger)]">
          {error}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <LoadingState message="Carregando entregas..." />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Bike}
          title="Nenhuma entrega no momento"
          description="Quando um pedido for despachado para você, ele aparece aqui."
        />
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                A caminho
              </h2>
              <div className="space-y-3">
                {pending.map((order) => {
                  const mapsUrl = mapsUrlForOrder(order);
                  return (
                  <Card key={order.id}>
                    <CardContent className="space-y-3 pt-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-[var(--text-primary)]">
                            Pedido #{order.daily_number}
                          </p>
                          <p className="text-sm text-[var(--text-secondary)]">
                            {order.customer_name || "Cliente"}
                          </p>
                        </div>
                        <Badge variant="warning">Saiu às {formatTime(order.dispatched_at)}</Badge>
                      </div>

                      <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{fullAddress(order) || "Endereço não informado"}</span>
                      </div>

                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-sm font-medium text-brand-red underline underline-offset-2"
                        >
                          <Navigation className="h-4 w-4 shrink-0" />
                          {order.delivery_latitude != null ? "Abrir localização marcada no mapa" : "Abrir endereço no mapa"}
                        </a>
                      )}

                      {order.customer_phone && (
                        <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                          <span className="flex items-center gap-2">
                            <Phone className="h-4 w-4 shrink-0" />
                            <a href={`tel:${order.customer_phone}`} className="underline">
                              {order.customer_phone}
                            </a>
                          </span>
                          <a
                            href={whatsappUrlForPhone(
                              order.customer_phone,
                              `Olá! Aqui é o motoboy do pedido #${order.daily_number} da Marcos Krep's.`,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 font-medium text-emerald-600 underline underline-offset-2"
                          >
                            <MessageCircle className="h-4 w-4 shrink-0" />
                            WhatsApp
                          </a>
                        </div>
                      )}

                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        Total: {formatCurrency(order.total_amount)}
                      </p>

                      <Button
                        className="w-full"
                        onClick={() => void handleConfirmDelivery(order.id)}
                        loading={confirmingId === order.id}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Confirmar entrega
                      </Button>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            </section>
          )}

          {delivered.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Entregues hoje
              </h2>
              <div className="space-y-3">
                {delivered.map((order) => (
                  <Card key={order.id} className="opacity-70">
                    <CardContent className="flex items-center justify-between pt-4">
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">
                          Pedido #{order.daily_number}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {order.customer_name || "Cliente"}
                        </p>
                      </div>
                      <Badge variant="success">
                        Entregue às {formatTime(order.delivery_delivered_at)}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
