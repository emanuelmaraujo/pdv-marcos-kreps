"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Clock,
  CreditCard,
  Gift,
  Loader2,
  QrCode,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  CaixaData,
  PaymentBreakdown,
  PendingOrder,
  TopProduct,
  cashApi,
} from "@/lib/api/cash-api";
import { PaymentMethod } from "@/types/pdv";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

const PAYMENT_ICONS: Record<PaymentMethod, React.ElementType> = {
  PIX: QrCode,
  CASH: Banknote,
  DEBIT_CARD: CreditCard,
  CREDIT_CARD: CreditCard,
  COURTESY: Gift,
  PENDING: Clock,
};

const PAYMENT_COLORS: Record<PaymentMethod, string> = {
  PIX: "text-teal-600 bg-teal-50",
  CASH: "text-emerald-600 bg-emerald-50",
  DEBIT_CARD: "text-blue-600 bg-blue-50",
  CREDIT_CARD: "text-violet-600 bg-violet-50",
  COURTESY: "text-pink-600 bg-pink-50",
  PENDING: "text-amber-600 bg-amber-50",
};

export default function CaixaPage() {
  const [data, setData] = useState<CaixaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadCash = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError("");
    try {
      const nextData = await cashApi.getDaySummary();
      setData(nextData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar caixa");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const nextData = await cashApi.getDaySummary();
        if (!cancelled) setData(nextData);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar caixa");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const lastUpdate = data?.generatedAt
    ? timeFormatter.format(new Date(data.generatedAt))
    : null;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-background px-4 py-3 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-black text-brand-charcoal">Caixa do dia</h1>
            {lastUpdate && (
              <p className="text-xs text-zinc-400">Atualizado às {lastUpdate}</p>
            )}
          </div>
          <div className="flex gap-2">
            {data?.role === "ADMIN" && (
              <Link href="/app/caixa/relatorio">
                <Button size="sm" className="gap-2 bg-brand-charcoal hover:bg-brand-black">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Relatório</span>
                </Button>
              </Link>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadCash(true)}
              disabled={isLoading || isRefreshing}
              className="gap-2"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-6">
        {isLoading && !data ? (
          <LoadingState message="Carregando resumo do dia..." />
        ) : error ? (
          <ErrorState
            title="Não foi possível carregar o caixa"
            message={error}
            onRetry={() => loadCash(false)}
          />
        ) : !data ? null : data.summary.totalPedidos === 0 ? (
          <EmptyState
            title="Sem vendas hoje"
            description="Os pedidos do dia aparecerão aqui assim que forem criados."
          />
        ) : (
          <div className="space-y-4">
            <CashHero data={data} />
            <MetricsGrid data={data} />
            {data.pendingOrders.length > 0 && (
              <PendingOrdersSection orders={data.pendingOrders} />
            )}
            <TopProductsSection products={data.topProducts.slice(0, 3)} />
            <PaymentBreakdownSection
              items={data.paymentBreakdown}
              received={data.summary.totalRecebido}
            />
            <QuickLinks role={data.role} />
          </div>
        )}
      </div>
    </div>
  );
}

function CashHero({ data }: { data: CaixaData }) {
  const paidRate =
    data.summary.totalPedidos > 0
      ? Math.round((data.summary.pedidosPagos / data.summary.totalPedidos) * 100)
      : 0;

  return (
    <Card className="overflow-hidden border-0 bg-brand-charcoal shadow-lg">
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Movimento de hoje
            </p>
            <p className="mt-1 text-4xl font-black tracking-tight text-white">
              {currency.format(data.summary.totalRecebido)}
            </p>
            <p className="mt-2 text-sm text-zinc-300">
              {paidRate}% dos pedidos pagos
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-64">
            <HeroMini label="Bruto" value={currency.format(data.summary.totalBruto)} />
            <HeroMini label="Pendente" value={currency.format(data.summary.totalPendente)} />
            <HeroMini label="Ticket" value={currency.format(data.summary.ticketMedio)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HeroMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <p className="text-[10px] font-bold uppercase text-zinc-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function MetricsGrid({ data }: { data: CaixaData }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <MetricCard
        label="Recebido"
        value={currency.format(data.summary.totalRecebido)}
        sub={`${data.summary.pedidosPagos} pagos`}
        icon={TrendingUp}
        tone="emerald"
      />
      <MetricCard
        label="Pedidos"
        value={String(data.summary.totalPedidos)}
        sub={`${data.summary.pedidosCancelados} cancelados`}
        icon={ShoppingBag}
        tone="zinc"
      />
      <MetricCard
        label="Ticket médio"
        value={currency.format(data.summary.ticketMedio)}
        sub="Por pedido pago"
        icon={CreditCard}
        tone="blue"
        hidden={data.role === "ATTENDANT"}
      />
      <MetricCard
        label="Pendente"
        value={currency.format(data.summary.totalPendente)}
        sub={`${data.summary.pedidosPendentes} pedidos`}
        icon={Clock}
        tone={data.summary.pedidosPendentes > 0 ? "amber" : "zinc"}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  hidden,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  tone: "amber" | "blue" | "emerald" | "zinc";
  hidden?: boolean;
}) {
  if (hidden) return null;
  const colors = {
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    zinc: "bg-zinc-100 text-brand-charcoal",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            {label}
          </span>
          <span className={`rounded-lg p-2 ${colors[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="text-2xl font-black leading-tight text-brand-charcoal">{value}</p>
        <p className="mt-1 text-xs text-zinc-400">{sub}</p>
      </CardContent>
    </Card>
  );
}

function PendingOrdersSection({ orders }: { orders: PendingOrder[] }) {
  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-black text-brand-charcoal">Pedidos pendentes</h2>
          <Badge variant="warning">{orders.length}</Badge>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-brand-charcoal">
                    Pedido #{String(order.daily_number).padStart(3, "0")}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {timeFormatter.format(new Date(order.created_at))}
                  </p>
                </div>
                <p className="text-base font-black text-brand-amber">
                  {currency.format(order.total_amount)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <Link
          href="/app/pedidos"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-100 text-sm font-bold text-amber-900 transition-colors hover:bg-amber-200 active:scale-[0.97]"
        >
          Ver em Pedidos
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

function TopProductsSection({ products }: { products: TopProduct[] }) {
  if (products.length === 0) return null;
  const maxQuantity = Math.max(...products.map((p) => p.quantity), 1);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-brand-amber" />
          <h2 className="text-sm font-black text-brand-charcoal">Mais vendidos hoje</h2>
        </div>
        {products.map((product, index) => (
          <div key={product.name} className="space-y-2 rounded-xl border border-zinc-100 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-charcoal text-sm font-black text-white">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-brand-charcoal">{product.name}</p>
                  <p className="text-xs text-zinc-400">{product.quantity} unidades</p>
                </div>
              </div>
              <p className="shrink-0 text-sm font-black text-brand-charcoal">
                {currency.format(product.revenue)}
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-brand-red"
                style={{ width: `${(product.quantity / maxQuantity) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PaymentBreakdownSection({
  items,
  received,
}: {
  items: PaymentBreakdown[];
  received: number;
}) {
  const nonEmpty = items.filter((i) => i.count > 0 && i.method !== "PENDING" && i.method !== "COURTESY");
  if (nonEmpty.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-black text-brand-charcoal">Meios de pagamento</h2>
        {nonEmpty.map((item) => {
          const Icon = PAYMENT_ICONS[item.method] ?? Wallet;
          const colorClass = PAYMENT_COLORS[item.method] ?? "text-zinc-600 bg-zinc-100";
          const [textColor, bgColor] = colorClass.split(" ");
          const percent = received > 0 ? Math.round((item.total / received) * 100) : 0;

          return (
            <div key={item.method} className="flex items-center gap-3">
              <span className={`rounded-lg p-2 ${bgColor}`}>
                <Icon className={`h-4 w-4 ${textColor}`} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-brand-charcoal">{item.label}</p>
                  <p className="shrink-0 text-sm font-black text-brand-charcoal">
                    {currency.format(item.total)}
                  </p>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-brand-red"
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-xs font-bold text-zinc-400">{percent}%</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function QuickLinks({ role }: { role: CaixaData["role"] }) {
  return (
    <div className={`grid gap-3 ${role === "ADMIN" ? "grid-cols-2" : "grid-cols-1"}`}>
      <Link
        href="/app/pedidos"
        className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-700 transition-colors hover:bg-zinc-100 active:scale-[0.97]"
      >
        <ShoppingBag className="h-4 w-4" />
        Ver pedidos de hoje
        <ArrowRight className="h-4 w-4" />
      </Link>
      {role === "ADMIN" && (
        <Link
          href="/app/caixa/relatorio"
          className="flex items-center justify-center gap-2 rounded-xl border border-brand-charcoal bg-brand-charcoal px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-charcoal/90 active:scale-[0.97]"
        >
          <BarChart3 className="h-4 w-4" />
          Relatório gerencial
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

