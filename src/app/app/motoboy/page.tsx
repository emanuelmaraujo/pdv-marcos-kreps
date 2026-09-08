"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BellRing,
  Bike,
  CheckCircle2,
  DollarSign,
  History,
  LocateFixed,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { createClient } from "@/lib/supabase/client";
import { pdvApi } from "@/lib/api/pdv-api";
import { Order } from "@/types/pdv";
import { whatsappUrlForPhone } from "@/lib/utils/whatsapp";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/feedback/LoadingState";
import { EmptyState } from "@/components/feedback/EmptyState";
import {
  courierPeriodRange,
  fetchCourierOrdersBetween,
  fetchCourierRecord,
  fetchOnRouteOrders,
  summarizeCourierOrders,
  type CourierRecord,
} from "./courier-orders";
import { FinishedOrderRow } from "./components/FinishedOrderRow";
import {
  formatCurrency,
  formatTime,
  fullAddress,
  getExactCoordinates,
  mapsDirectionsUrlForOrder,
} from "./motoboy-utils";

/**
 * Frequência do polling de fallback. O Realtime é quem entrega o pedido em
 * milissegundos; o polling curto existe porque a rede do motoboy cai o tempo
 * todo (4G ruim, tela bloqueada) e o WebSocket morre silenciosamente — sem ele
 * o pedido despachado ficava até um minuto sem aparecer.
 */
const POLL_MS = 15_000;
/** Tick só para o "atualizado há X" não mentir na tela. */
const CLOCK_TICK_MS = 10_000;

function formatRelative(from: Date | null, now: number): string {
  if (!from) return "—";
  const seconds = Math.max(0, Math.round((now - from.getTime()) / 1000));
  if (seconds < 45) return "agora mesmo";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `há ${hours}h`;
}

function notifyNewDelivery() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([180, 90, 180]);
    }
  } catch {
    // Vibração é um extra — nunca pode derrubar a atualização da lista.
  }
}

export default function MotoboyPage() {
  const { user, isLoading: userLoading, isCourier } = useUser();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [courier, setCourier] = useState<CourierRecord | null>(null);
  const [onRoute, setOnRoute] = useState<Order[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [clock, setClock] = useState(() => Date.now());

  /** ids já vistos na rua — null enquanto a primeira carga não terminou. */
  const knownOnRouteIds = useRef<Set<string> | null>(null);

  const courierId = courier?.id ?? null;

  useEffect(() => {
    if (!userLoading && !isCourier) router.replace("/app");
  }, [userLoading, isCourier, router]);

  // Cadastro do entregador: uma vez por sessão, sem repetir a cada refresh.
  useEffect(() => {
    if (!user || !isCourier) return;
    let cancelled = false;

    void (async () => {
      try {
        const record = await fetchCourierRecord(supabase, user.id);
        if (!cancelled) setCourier(record);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar seu cadastro.");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isCourier, supabase]);

  const loadOrders = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!courierId) return;
      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const { start, end } = courierPeriodRange("today");
        const [routeOrders, dayOrders] = await Promise.all([
          fetchOnRouteOrders(supabase, courierId),
          fetchCourierOrdersBetween(supabase, courierId, start, end),
        ]);

        // Avisa o motoboy do que chegou desde a última leitura — a queixa era
        // exatamente pedido despachado que ficava invisível na tela.
        const seen = knownOnRouteIds.current;
        const arrived = seen ? routeOrders.filter((order) => !seen.has(order.id)).length : 0;
        if (arrived > 0) {
          setNewOrderCount((count) => count + arrived);
          notifyNewDelivery();
        }
        knownOnRouteIds.current = new Set(routeOrders.map((order) => order.id));

        setOnRoute(routeOrders);
        setTodayOrders(dayOrders);
        setLastSyncAt(new Date());
        setError("");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro ao carregar entregas.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [courierId, supabase],
  );

  /**
   * Atualização em camadas (mesma estratégia do quadro de pedidos):
   *   1. Realtime filtrado por courier_id — chega em ms.
   *   2. Polling de 15s enquanto a tela está visível — cobre WebSocket caído.
   *   3. Refresh ao voltar para a aba e ao recuperar a conexão.
   */
  useEffect(() => {
    if (!courierId) return;

    const initialTimer = window.setTimeout(() => void loadOrders(), 0);

    let debounceTimer: number | null = null;
    const scheduleRefresh = () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        void loadOrders({ silent: true });
      }, 300);
    };

    const channel = supabase
      .channel(`courier-orders-${courierId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `courier_id=eq.${courierId}`,
        },
        scheduleRefresh,
      )
      .subscribe((status) => setIsLive(status === "SUBSCRIBED"));

    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadOrders({ silent: true });
    }, POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadOrders({ silent: true });
    };
    const onOnline = () => void loadOrders({ silent: true });

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    window.addEventListener("online", onOnline);

    return () => {
      window.clearTimeout(initialTimer);
      if (debounceTimer) window.clearTimeout(debounceTimer);
      window.clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
      window.removeEventListener("online", onOnline);
      void supabase.removeChannel(channel);
      setIsLive(false);
    };
  }, [courierId, loadOrders, supabase]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const handleConfirmDelivery = async (orderId: string) => {
    setConfirmingId(orderId);
    setError("");
    try {
      await pdvApi.confirmDelivery({ orderId });
      // Some da lista na hora; o reload silencioso reconcilia com o servidor.
      setOnRoute((orders) => orders.filter((order) => order.id !== orderId));
      knownOnRouteIds.current?.delete(orderId);
      await loadOrders({ silent: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao confirmar entrega.");
      await loadOrders({ silent: true });
    } finally {
      setConfirmingId(null);
    }
  };

  const balance = useMemo(() => summarizeCourierOrders(todayOrders), [todayOrders]);
  const finishedToday = useMemo(
    () => todayOrders.filter((order) => order.status !== "SAIU_PARA_ENTREGA"),
    [todayOrders],
  );
  const pendingFees = useMemo(
    () => onRoute.reduce((total, order) => total + Number(order.delivery_fee ?? 0), 0),
    [onRoute],
  );

  if (userLoading || !isCourier) {
    return <LoadingState message="Carregando..." />;
  }

  const hasAnything = onRoute.length > 0 || finishedToday.length > 0;

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
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
          onClick={() => void loadOrders({ silent: true })}
          disabled={loading || refreshing}
          aria-label="Atualizar entregas agora"
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading || refreshing ? "animate-spin" : ""}`} />
          <span className="ml-1.5">Atualizar</span>
        </Button>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
        <span className="inline-flex items-center gap-1.5">
          {isLive ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-[var(--status-success)]" />
              <span className="font-semibold text-[var(--status-success)]">Ao vivo</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-[var(--status-warning)]" />
              <span className="font-semibold text-[var(--status-warning)]">
                Reconectando · atualizando a cada 15s
              </span>
            </>
          )}
        </span>
        <span aria-live="polite">
          Atualizado {formatRelative(lastSyncAt, clock)}
          {lastSyncAt ? ` (${formatTime(lastSyncAt.toISOString())})` : ""}
        </span>
        <Link
          href="/app/motoboy/historico"
          className="inline-flex items-center gap-1.5 font-semibold text-brand-red underline underline-offset-2"
        >
          <History className="h-3.5 w-3.5" />
          Histórico e saldo
        </Link>
      </div>

      {newOrderCount > 0 && (
        <button
          type="button"
          onClick={() => setNewOrderCount(0)}
          className="mb-4 flex w-full items-center gap-2 rounded-xl border border-[var(--status-success)] bg-[var(--status-success-bg)] p-3 text-left text-sm font-semibold text-[var(--status-success)]"
        >
          <BellRing className="h-4 w-4 shrink-0" />
          {newOrderCount === 1
            ? "1 novo pedido despachado para você"
            : `${newOrderCount} novos pedidos despachados para você`}
          <span className="ml-auto text-xs font-medium underline">ok</span>
        </button>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-[var(--status-danger)] bg-[var(--status-danger-bg)] p-3 text-sm text-[var(--status-danger)]">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--text-secondary)]">A caminho</p>
            <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{onRoute.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--text-secondary)]">Entregues hoje</p>
            <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{balance.delivered}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--text-secondary)]">Ganhos hoje</p>
            <p className="mt-1 text-base font-bold text-[var(--status-success)]">
              {formatCurrency(balance.earnings)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--text-secondary)]">A receber (na rua)</p>
            <p className="mt-1 text-base font-bold text-[var(--text-primary)]">
              {formatCurrency(pendingFees)}
            </p>
          </CardContent>
        </Card>
      </div>

      {loading && !hasAnything ? (
        <LoadingState message="Carregando entregas..." />
      ) : !hasAnything ? (
        <EmptyState
          icon={Bike}
          title="Nenhuma entrega no momento"
          description="Quando um pedido for despachado para você, ele aparece aqui automaticamente."
        />
      ) : (
        <div className="space-y-6">
          {onRoute.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                A caminho
              </h2>
              <div className="space-y-3">
                {onRoute.map((order) => {
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

          {finishedToday.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Encerradas hoje
              </h2>
              <div className="space-y-2">
                {finishedToday.map((order) => (
                  <FinishedOrderRow key={order.id} order={order} />
                ))}
              </div>
              <Link
                href="/app/motoboy/historico"
                className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)]"
              >
                <History className="h-4 w-4" />
                Ver histórico de outros dias
              </Link>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
