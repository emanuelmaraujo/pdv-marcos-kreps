"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bike, ChevronDown, ChevronRight, RefreshCw, Wallet } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { createClient } from "@/lib/supabase/client";
import { Order } from "@/types/pdv";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/feedback/LoadingState";
import { EmptyState } from "@/components/feedback/EmptyState";
import {
  COURIER_PERIOD_LABELS,
  courierPeriodRange,
  fetchCourierOrdersBetween,
  fetchCourierRecord,
  formatBusinessDayLabel,
  formatRangeLabel,
  groupCourierOrdersByDay,
  summarizeCourierOrders,
  type CourierPeriod,
  type CourierRecord,
} from "../courier-orders";
import { FinishedOrderRow } from "../components/FinishedOrderRow";
import { formatCurrency } from "../motoboy-utils";

const PERIODS: CourierPeriod[] = ["today", "yesterday", "last7", "last30", "custom"];

/** "YYYY-MM-DD" de hoje no fuso local — teto do seletor de data. */
function todayInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function MotoboyHistoricoPage() {
  const { user, isLoading: userLoading, isCourier } = useUser();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [courier, setCourier] = useState<CourierRecord | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<CourierPeriod>("today");
  const [customDay, setCustomDay] = useState<string>(() => todayInputValue());
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const courierId = courier?.id ?? null;

  useEffect(() => {
    if (!userLoading && !isCourier) router.replace("/app");
  }, [userLoading, isCourier, router]);

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

  const range = useMemo(() => courierPeriodRange(period, customDay), [period, customDay]);

  const loadHistory = useCallback(async () => {
    if (!courierId) return;
    setLoading(true);
    try {
      const data = await fetchCourierOrdersBetween(supabase, courierId, range.start, range.end);
      setOrders(data);
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  }, [courierId, supabase, range.start, range.end]);

  useEffect(() => {
    if (!courierId) return;
    const timer = window.setTimeout(() => void loadHistory(), 0);
    return () => window.clearTimeout(timer);
  }, [courierId, loadHistory]);

  const balance = useMemo(() => summarizeCourierOrders(orders), [orders]);
  const days = useMemo(() => groupCourierOrdersByDay(orders), [orders]);
  const workedDays = days.length;

  if (userLoading || !isCourier) {
    return <LoadingState message="Carregando..." />;
  }

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <header className="mb-4">
        <Link
          href="/app/motoboy"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para as entregas
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              <Wallet className="h-6 w-6 text-brand-red" />
              Histórico e saldo
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {formatRangeLabel(range)} · todos os pedidos despachados para você, inclusive os
              confirmados pelo atendente.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadHistory()}
            disabled={loading}
            aria-label="Atualizar histórico"
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {PERIODS.map((option) => {
          const active = period === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setPeriod(option)}
              aria-pressed={active}
              className={`min-h-9 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-brand-red bg-brand-red text-white"
                  : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
              }`}
            >
              {COURIER_PERIOD_LABELS[option]}
            </button>
          );
        })}
        {period === "custom" && (
          <input
            type="date"
            value={customDay}
            max={todayInputValue()}
            onChange={(event) => setCustomDay(event.target.value)}
            aria-label="Escolher o dia do histórico"
            className="min-h-9 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--text-primary)]"
          />
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-[var(--status-danger)] bg-[var(--status-danger-bg)] p-3 text-sm text-[var(--status-danger)]">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--text-secondary)]">Ganhos no período</p>
            <p className="mt-1 text-xl font-bold text-[var(--status-success)]">
              {formatCurrency(balance.earnings)}
            </p>
            {balance.pendingEarnings > 0 && (
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                + {formatCurrency(balance.pendingEarnings)} ainda na rua
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--text-secondary)]">Entregas concluídas</p>
            <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{balance.delivered}</p>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              {balance.totalOrders} despachados
              {balance.cancelled > 0 ? ` · ${balance.cancelled} cancelados` : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--text-secondary)]">Média por entrega</p>
            <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
              {formatCurrency(balance.averageEarning)}
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              {workedDays} {workedDays === 1 ? "dia com corrida" : "dias com corrida"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--text-secondary)]">Recebido do cliente</p>
            <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
              {formatCurrency(balance.collectedOnDelivery)}
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              pedidos entregues sem pagamento na loja
            </p>
          </CardContent>
        </Card>
      </div>

      {loading && orders.length === 0 ? (
        <LoadingState message="Carregando histórico..." />
      ) : days.length === 0 ? (
        <EmptyState
          icon={Bike}
          title="Nenhuma entrega neste período"
          description="Escolha outro dia ou um período maior para ver suas corridas."
        />
      ) : (
        <div className="space-y-3">
          {days.map((day) => {
            const isOpen = expandedDays[day.key] ?? days.length === 1;
            return (
              <Card key={day.key}>
                <CardContent className="p-0">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDays((current) => ({ ...current, [day.key]: !isOpen }))
                    }
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text-primary)]">
                        {formatBusinessDayLabel(day.key)}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {day.balance.delivered}{" "}
                        {day.balance.delivered === 1 ? "entrega" : "entregas"}
                        {day.balance.onRoute > 0 ? ` · ${day.balance.onRoute} na rua` : ""}
                        {day.balance.cancelled > 0 ? ` · ${day.balance.cancelled} cancelados` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-base font-bold text-[var(--status-success)]">
                        {formatCurrency(day.balance.earnings)}
                      </span>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="space-y-2 border-t border-[var(--border)] p-4">
                      {day.orders.map((order) => (
                        <FinishedOrderRow key={order.id} order={order} />
                      ))}
                      {day.balance.collectedOnDelivery > 0 && (
                        <p className="pt-1 text-xs text-[var(--text-secondary)]">
                          Recebido do cliente neste dia:{" "}
                          <strong className="text-[var(--text-primary)]">
                            {formatCurrency(day.balance.collectedOnDelivery)}
                          </strong>
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
