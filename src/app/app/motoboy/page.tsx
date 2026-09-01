"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bike,
  CheckCircle2,
  DollarSign,
  LocateFixed,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  RefreshCw,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { createClient } from "@/lib/supabase/client";
import { pdvApi } from "@/lib/api/pdv-api";
import { Order } from "@/types/pdv";
import { getBusinessDayRange } from "@/lib/utils/business-day";
import { whatsappUrlForPhone } from "@/lib/utils/whatsapp";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/feedback/LoadingState";
import { EmptyState } from "@/components/feedback/EmptyState";
import {
  formatCurrency,
  formatTime,
  fullAddress,
  getExactCoordinates,
  mapsDirectionsUrlForOrder,
} from "./motoboy-utils";

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

      const { start, end } = getBusinessDayRange();
      const [pendingResult, deliveredResult] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .eq("courier_id", courier.id)
          .eq("status", "SAIU_PARA_ENTREGA")
          .order("dispatched_at", { ascending: false })
          .limit(50),
        supabase
          .from("orders")
          .select("*")
          .eq("courier_id", courier.id)
          .eq("status", "ENTREGUE")
          .gte("delivery_delivered_at", start.toISOString())
          .lt("delivery_delivered_at", end.toISOString())
          .order("delivery_delivered_at", { ascending: false })
          .limit(50),
      ]);

      if (pendingResult.error) throw pendingResult.error;
      if (deliveredResult.error) throw deliveredResult.error;
      setOrders([
        ...((pendingResult.data ?? []) as Order[]),
        ...((deliveredResult.data ?? []) as Order[]),
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar entregas.");
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (!isCourier) return;
    const initialTimer = window.setTimeout(() => void loadOrders(), 0);
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadOrders();
    }, 60_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void loadOrders();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
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
  const deliveredEarnings = delivered.reduce((total, order) => total + Number(order.delivery_fee ?? 0), 0);

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
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadOrders()}
          disabled={loading}
          aria-label="Atualizar entregas"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-[var(--status-danger)] bg-[var(--status-danger-bg)] p-3 text-sm text-[var(--status-danger)]">
          {error}
        </div>
      )}

      {orders.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-[var(--text-secondary)]">A caminho</p>
              <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{pending.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-[var(--text-secondary)]">Entregues hoje</p>
              <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{delivered.length}</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-3">
              <p className="text-xs text-[var(--text-secondary)]">Ganhos hoje</p>
              <p className="mt-1 text-base font-bold text-[var(--status-success)]">
                {formatCurrency(deliveredEarnings)}
              </p>
            </CardContent>
          </Card>
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
                  const mapsUrl = mapsDirectionsUrlForOrder(order);
                  const exactCoordinates = getExactCoordinates(order);
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
                        <div>
                          <p>{fullAddress(order) || "Endereço não informado"}</p>
                          {order.delivery_reference && (
                            <p className="mt-1 text-xs">
                              <span className="font-semibold">Referência:</span> {order.delivery_reference}
                            </p>
                          )}
                        </div>
                      </div>

                      {exactCoordinates && (
                        <div className="rounded-xl border border-[var(--status-success)] bg-[var(--status-success-bg)] p-3 text-[var(--status-success)]">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <LocateFixed className="h-4 w-4 shrink-0" />
                            Localização exata marcada no checkout
                          </div>
                          <p className="mt-1 pl-6 font-mono text-[11px]">
                            {exactCoordinates.latitude.toFixed(6)}, {exactCoordinates.longitude.toFixed(6)}
                          </p>
                        </div>
                      )}

                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-red px-3 py-2 text-sm font-semibold text-brand-red transition-colors hover:bg-[var(--status-danger-bg)]"
                        >
                          <Navigation className="h-4 w-4 shrink-0" />
                          {exactCoordinates ? "Iniciar rota até o ponto exato" : "Iniciar rota pelo endereço"}
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

                      <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-subtle)] p-3">
                        <div>
                          <p className="text-xs text-[var(--text-secondary)]">Valor do pedido</p>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {formatCurrency(order.total_amount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="flex items-center justify-end gap-1 text-xs text-[var(--text-secondary)]">
                            <DollarSign className="h-3.5 w-3.5" />
                            Ganho da corrida
                          </p>
                          <p className="text-base font-bold text-[var(--status-success)]">
                            {formatCurrency(order.delivery_fee)}
                          </p>
                        </div>
                      </div>

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
                  <Card key={order.id}>
                    <CardContent className="space-y-3 pt-4">
                      <div className="flex items-center justify-between gap-3">
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
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-[var(--status-success-bg)] px-3 py-2">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--status-success)]">
                          <DollarSign className="h-4 w-4" />
                          Ganho desta corrida
                        </span>
                        <strong className="text-[var(--status-success)]">
                          {formatCurrency(order.delivery_fee)}
                        </strong>
                      </div>
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
