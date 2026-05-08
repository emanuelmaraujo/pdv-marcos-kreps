"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Clock,
  CreditCard,
  Gift,
  Loader2,
  Package,
  Percent,
  QrCode,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { BarChart3 } from "lucide-react";
import {
  CaixaData,
  PaymentBreakdown,
  PendingOrder,
  StatusBreakdown,
  TopProduct,
  cashApi,
} from "@/lib/api/cash-api";
import { OrderStatus, PaymentMethod } from "@/types/pdv";

/* ─── Formatters ─────────────────────────────────────── */

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

/* ─── Page ───────────────────────────────────────────── */

export default function CaixaPage() {
  const [data, setData] = useState<CaixaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadCash = useCallback(async (refreshing = false) => {
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
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
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar caixa");
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
  }, []);

  const lastUpdate = data?.generatedAt
    ? timeFormatter.format(new Date(data.generatedAt))
    : null;

  return (
    <div className="flex h-full flex-col bg-background">
      <PageHeader
        title="Caixa"
        subtitle="Resumo do dia"
        action={
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
            Atualizar
          </Button>
        }
      />

      {/* ─── Admin Shortcut ─── */}
      {data?.role === "ADMIN" && (
        <div className="px-4 pt-4">
          <Link href="/app/caixa/relatorio">
            <Button className="w-full gap-2 bg-brand-charcoal hover:bg-brand-black">
              <BarChart3 className="h-4 w-4" />
              Relatório Gerencial Completo
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {isLoading && !data ? (
          <LoadingState message="Carregando resumo do dia..." />
        ) : error ? (
          <ErrorState
            title="Não foi possível carregar o caixa"
            message={error}
            onRetry={() => loadCash(false)}
          />
        ) : !data ? null : data.summary.totalPedidos === 0 ? (
          <div className="space-y-4">
            <EmptyState
              title="Sem vendas hoje"
              description="Os pedidos do dia aparecerão aqui assim que forem criados."
            />
            <CashNote role={data.role} lastUpdate={lastUpdate} />
          </div>
        ) : (
          <div className="space-y-4">
            <CashNote role={data.role} lastUpdate={lastUpdate} />

            {/* ─── Hero Card: Recebido Hoje ─── */}
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-brand-charcoal to-brand-black shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Recebido hoje
                    </p>
                    <p className="mt-1 text-3xl font-black tracking-tight text-white">
                      {currency.format(data.summary.totalRecebido)}
                    </p>
                    <p className="mt-1.5 text-xs text-zinc-400">
                      {data.summary.pedidosPagos} pedidos pagos
                    </p>
                  </div>
                  <div className="rounded-xl bg-brand-amber/20 p-2.5">
                    <TrendingUp className="h-6 w-6 text-brand-yellow" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ─── Metrics Grid ─── */}
            <section className="grid grid-cols-2 gap-3">
              <MetricCard
                label="Total bruto"
                value={currency.format(data.summary.totalBruto)}
                sub="Não cancelados"
                icon={ReceiptText}
                iconBg="bg-zinc-100"
                iconColor="text-brand-charcoal"
              />
              <MetricCard
                label="Pendente"
                value={currency.format(data.summary.totalPendente)}
                sub={`${data.summary.pedidosPendentes} pedidos`}
                icon={Clock}
                iconBg="bg-amber-50"
                iconColor="text-brand-amber"
              />
              <MetricCard
                label="Pedidos"
                value={String(data.summary.totalPedidos)}
                sub={`${data.summary.pedidosPagos} pagos`}
                icon={ShoppingBag}
                iconBg="bg-zinc-100"
                iconColor="text-brand-charcoal"
              />
              <MetricCard
                label="Ticket médio"
                value={currency.format(data.summary.ticketMedio)}
                sub="Recebido / pagos"
                icon={CreditCard}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
                hidden={data.role === "ATTENDANT"}
              />
              <MetricCard
                label="Embalagem"
                value={currency.format(data.summary.totalEmbalagem)}
                sub="Taxas do dia"
                icon={Package}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
              />
              <MetricCard
                label="Cancelados"
                value={String(data.summary.pedidosCancelados)}
                sub={currency.format(data.summary.totalCancelado)}
                icon={AlertTriangle}
                iconBg="bg-red-50"
                iconColor="text-red-500"
              />
            </section>

            {/* ─── Pending Orders ─── */}
            <PendingOrdersSection orders={data.pendingOrders} />

            {/* ─── Discounts & Courtesy ─── */}
            <section className="grid grid-cols-2 gap-3">
              <MetricCard
                label="Descontos"
                value={currency.format(data.summary.totalDescontos)}
                sub={`${data.summary.pedidosComDesconto} pedidos`}
                icon={Percent}
                iconBg="bg-red-50"
                iconColor="text-red-500"
              />
              <MetricCard
                label="Cortesias"
                value={currency.format(data.summary.totalCortesia)}
                sub={`${data.summary.pedidosCortesia} pedidos`}
                icon={Gift}
                iconBg="bg-violet-50"
                iconColor="text-violet-600"
              />
            </section>

            {/* ─── Payment Breakdown ─── */}
            <PaymentBreakdownSection items={data.paymentBreakdown} />

            {/* ─── Order Status ─── */}
            <StatusBreakdownSection items={data.statusBreakdown} />

            {/* ─── Top Products ─── */}
            {data.role === "ADMIN" && <TopProductsSection products={data.topProducts} />}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────── */

function CashNote({ role, lastUpdate }: { role: CaixaData["role"]; lastUpdate: string | null }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="text-xs leading-relaxed text-amber-900">
        <p className="font-semibold">Resumo financeiro do dia</p>
        <p>
          Fonte: pedidos de hoje.
          {role === "ATTENDANT"
            ? " Seu perfil pode ver apenas o que a RLS permitir."
            : " Valores respeitam a RLS do usuário logado."}
        </p>
        {lastUpdate && <p className="mt-1 text-amber-700">Atualizado às {lastUpdate}.</p>}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
  hidden,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <Card>
      <CardContent className="p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            {label}
          </span>
          <span className={`rounded-lg p-1.5 ${iconBg}`}>
            <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
          </span>
        </div>
        <p className="text-xl font-black leading-tight text-brand-charcoal">{value}</p>
        <p className="mt-0.5 text-[11px] text-zinc-400">{sub}</p>
      </CardContent>
    </Card>
  );
}

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

function PaymentBreakdownSection({ items }: { items: PaymentBreakdown[] }) {
  const nonEmpty = items.filter((i) => i.count > 0);

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm">Vendas por pagamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {nonEmpty.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-400">
            Nenhuma venda registrada.
          </p>
        ) : (
          nonEmpty.map((item) => {
            const Icon = PAYMENT_ICONS[item.method] ?? Wallet;
            const colorClass = PAYMENT_COLORS[item.method] ?? "text-zinc-600 bg-zinc-100";
            const [textColor, bgColor] = colorClass.split(" ");

            return (
              <div
                key={item.method}
                className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className={`rounded-lg p-2 ${bgColor}`}>
                    <Icon className={`h-4 w-4 ${textColor}`} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-brand-charcoal">{item.label}</p>
                    <p className="text-[11px] text-zinc-400">{item.count} pedidos</p>
                  </div>
                </div>
                <span className="text-sm font-black text-brand-charcoal">
                  {currency.format(item.total)}
                </span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function StatusBreakdownSection({ items }: { items: StatusBreakdown[] }) {
  const nonEmpty = items.filter((i) => i.count > 0);

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm">Status dos pedidos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 p-4 pt-0">
        {nonEmpty.length === 0 ? (
          <p className="col-span-2 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-400">
            Nenhum pedido registrado.
          </p>
        ) : (
          nonEmpty.map((item) => (
            <div
              key={item.status}
              className={`rounded-xl border p-3 ${statusColor(item.status)}`}
            >
              <p className="text-[11px] font-semibold uppercase leading-snug text-zinc-500">
                {item.label}
              </p>
              <p className="mt-1 text-2xl font-black text-brand-charcoal">{item.count}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function PendingOrdersSection({ orders }: { orders: PendingOrder[] }) {
  return (
    <Card className={orders.length > 0 ? "border-amber-200 bg-amber-50/50" : ""}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm">Pedidos pendentes</CardTitle>
          <Badge variant={orders.length > 0 ? "warning" : "secondary"}>
            {orders.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5 p-4 pt-0">
        {orders.length === 0 ? (
          <p className="rounded-xl bg-white/70 p-3 text-sm font-medium text-zinc-500">
            Nenhum pedido com pagamento pendente.
          </p>
        ) : (
          <>
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-brand-charcoal">
                      Pedido #{order.daily_number}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {statusLabel(order.status)} · {timeFormatter.format(new Date(order.created_at))}
                    </p>
                  </div>
                  <p className="text-base font-black text-brand-amber">
                    {currency.format(order.total_amount)}
                  </p>
                </div>
              </div>
            ))}
            <Link
              href="/app/pedidos"
              className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-100 text-sm font-bold text-amber-900 transition-colors hover:bg-amber-200 active:scale-[0.97]"
            >
              Ver em Pedidos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TopProductsSection({ products }: { products: TopProduct[] }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-brand-amber" />
          <CardTitle className="text-sm">Mais vendidos</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5 p-4 pt-0">
        {products.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-400">
            Sem itens vendidos em pedidos não cancelados.
          </p>
        ) : (
          products.map((product, index) => (
            <div key={product.name} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-charcoal text-sm font-black text-white">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-brand-charcoal">{product.name}</p>
                  <p className="text-[11px] text-zinc-400">{product.quantity} unidades</p>
                </div>
              </div>
              <p className="shrink-0 text-sm font-black text-brand-charcoal">
                {currency.format(product.revenue)}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Helpers ────────────────────────────────────────── */

function statusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    AGUARDANDO_CONFIRMACAO: "Aguardando confirmação",
    AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
    NA_FILA: "Na fila",
    PRONTO: "Pronto",
    ENTREGUE: "Entregue",
    CANCELADO: "Cancelado",
    EXPIRADO: "Expirado",
  };
  return labels[status] ?? status;
}

function statusColor(status: OrderStatus): string {
  const colors: Record<OrderStatus, string> = {
    AGUARDANDO_CONFIRMACAO: "border-amber-200 bg-amber-50",
    AGUARDANDO_PAGAMENTO: "border-amber-200 bg-amber-50",
    NA_FILA: "border-blue-200 bg-blue-50",
    PRONTO: "border-emerald-200 bg-emerald-50",
    ENTREGUE: "border-zinc-200 bg-zinc-50",
    CANCELADO: "border-red-200 bg-red-50",
    EXPIRADO: "border-zinc-200 bg-zinc-50",
  };
  return colors[status] ?? "border-zinc-100 bg-zinc-50";
}
