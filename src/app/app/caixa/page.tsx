"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
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
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  CaixaData,
  PaymentBreakdown,
  PendingOrder,
  StatusBreakdown,
  TopProduct,
  cashApi,
} from "@/lib/api/cash-api";
import { OrderStatus, PaymentMethod } from "@/types/pdv";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

type CashTab = "overview" | "payments" | "sales" | "attention";

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
  const [activeTab, setActiveTab] = useState<CashTab>("overview");
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

  const insights = useMemo(() => (data ? buildCashInsights(data) : []), [data]);
  const lastUpdate = data?.generatedAt
    ? timeFormatter.format(new Date(data.generatedAt))
    : null;

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="sticky top-14 z-20 border-b border-zinc-200 bg-white">
        <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
            <CashTabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")} label="Visão" />
            <CashTabButton active={activeTab === "payments"} onClick={() => setActiveTab("payments")} label="Pagamentos" />
            <CashTabButton active={activeTab === "sales"} onClick={() => setActiveTab("sales")} label="Vendas" />
            <CashTabButton active={activeTab === "attention"} onClick={() => setActiveTab("attention")} label="Atenção" />
          </div>

          <div className="flex gap-2">
            {data?.role === "ADMIN" && (
              <Link href="/app/caixa/relatorio" className="flex-1 md:flex-none">
                <Button className="w-full gap-2 bg-brand-charcoal hover:bg-brand-black" size="sm">
                  <BarChart3 className="h-4 w-4" />
                  Relatório
                  <ArrowRight className="h-4 w-4" />
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
              Atualizar
            </Button>
          </div>
        </div>
      </div>

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
          <div className="space-y-4">
            <EmptyState
              title="Sem vendas hoje"
              description="Os pedidos do dia aparecerão aqui assim que forem criados."
            />
            <CashNote role={data.role} lastUpdate={lastUpdate} />
          </div>
        ) : (
          <div className="space-y-5">
            <CashHero data={data} lastUpdate={lastUpdate} />

            {activeTab === "overview" && (
              <div className="space-y-5">
                <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Recebido" value={currency.format(data.summary.totalRecebido)} sub={`${data.summary.pedidosPagos} pedidos pagos`} icon={TrendingUp} tone="emerald" />
                  <MetricCard label="Pendente" value={currency.format(data.summary.totalPendente)} sub={`${data.summary.pedidosPendentes} pedidos`} icon={Clock} tone="amber" />
                  <MetricCard label="Ticket médio" value={currency.format(data.summary.ticketMedio)} sub="Recebido / pagos" icon={CreditCard} tone="blue" hidden={data.role === "ATTENDANT"} />
                  <MetricCard label="Pedidos" value={String(data.summary.totalPedidos)} sub={`${data.summary.pedidosCancelados} cancelados`} icon={ShoppingBag} tone="zinc" />
                </section>
                <InsightGrid insights={insights} />
                <PendingOrdersSection orders={data.pendingOrders} />
              </div>
            )}

            {activeTab === "payments" && (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <PaymentBreakdownSection items={data.paymentBreakdown} received={data.summary.totalRecebido} />
                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <MetricCard label="Descontos" value={currency.format(data.summary.totalDescontos)} sub={`${data.summary.pedidosComDesconto} pedidos`} icon={Percent} tone="red" />
                  <MetricCard label="Cortesias" value={currency.format(data.summary.totalCortesia)} sub={`${data.summary.pedidosCortesia} pedidos`} icon={Gift} tone="violet" />
                  <MetricCard label="Embalagem" value={currency.format(data.summary.totalEmbalagem)} sub="Taxas do dia" icon={Package} tone="amber" />
                  <MetricCard label="Total bruto" value={currency.format(data.summary.totalBruto)} sub="Pedidos não cancelados" icon={ReceiptText} tone="zinc" />
                </section>
              </div>
            )}

            {activeTab === "sales" && (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
                <TopProductsSection products={data.topProducts} />
                <StatusBreakdownSection items={data.statusBreakdown} />
              </div>
            )}

            {activeTab === "attention" && (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <PendingOrdersSection orders={data.pendingOrders} />
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <AttentionRow label="Pagamentos pendentes" value={currency.format(data.summary.totalPendente)} count={data.summary.pedidosPendentes} tone="amber" />
                    <AttentionRow label="Cancelamentos" value={currency.format(data.summary.totalCancelado)} count={data.summary.pedidosCancelados} tone="red" />
                    <AttentionRow label="Descontos aplicados" value={currency.format(data.summary.totalDescontos)} count={data.summary.pedidosComDesconto} tone="zinc" />
                    <AttentionRow label="Cortesias" value={currency.format(data.summary.totalCortesia)} count={data.summary.pedidosCortesia} tone="violet" />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CashHero({ data, lastUpdate }: { data: CaixaData; lastUpdate: string | null }) {
  const paidRate =
    data.summary.totalPedidos > 0
      ? Math.round((data.summary.pedidosPagos / data.summary.totalPedidos) * 100)
      : 0;

  return (
    <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_0.8fr]">
      <Card className="overflow-hidden border-0 bg-brand-charcoal shadow-lg">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Movimento de hoje
              </p>
              <p className="mt-1 text-3xl font-black tracking-tight text-white md:text-4xl">
                {currency.format(data.summary.totalRecebido)}
              </p>
              <p className="mt-2 text-sm text-zinc-300">
                {paidRate}% dos pedidos pagos
                {lastUpdate ? ` · atualizado às ${lastUpdate}` : ""}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-72">
              <HeroMini label="Bruto" value={currency.format(data.summary.totalBruto)} />
              <HeroMini label="Pendente" value={currency.format(data.summary.totalPendente)} />
              <HeroMini label="Ticket" value={currency.format(data.summary.ticketMedio)} />
            </div>
          </div>
        </CardContent>
      </Card>
      <CashNote role={data.role} lastUpdate={lastUpdate} />
    </section>
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

function CashTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wide transition-all ${
        active
          ? "bg-brand-charcoal text-white shadow-sm"
          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

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
  tone,
  hidden,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  tone: "amber" | "blue" | "emerald" | "red" | "violet" | "zinc";
  hidden?: boolean;
}) {
  if (hidden) return null;
  const colors = {
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
    violet: "bg-violet-50 text-violet-600",
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

function InsightGrid({ insights }: { insights: CashInsight[] }) {
  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {insights.map((insight) => (
        <Card key={insight.title} className={insight.className}>
          <CardContent className="p-4">
            <p className="text-xs font-black uppercase tracking-wide text-zinc-500">{insight.title}</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-brand-charcoal">
              {insight.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function PaymentBreakdownSection({
  items,
  received,
}: {
  items: PaymentBreakdown[];
  received: number;
}) {
  const nonEmpty = items.filter((i) => i.count > 0);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-brand-charcoal">Meios de pagamento</h2>
            <p className="text-xs text-zinc-400">Ranking por valor recebido e quantidade</p>
          </div>
          <Badge variant="secondary">{nonEmpty.length} ativos</Badge>
        </div>

        {nonEmpty.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-400">
            Nenhuma venda registrada.
          </p>
        ) : (
          nonEmpty.map((item) => {
            const Icon = PAYMENT_ICONS[item.method] ?? Wallet;
            const colorClass = PAYMENT_COLORS[item.method] ?? "text-zinc-600 bg-zinc-100";
            const [textColor, bgColor] = colorClass.split(" ");
            const percent = received > 0 ? Math.round((item.total / received) * 100) : 0;

            return (
              <div key={item.method} className="rounded-xl border border-zinc-100 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`rounded-lg p-2 ${bgColor}`}>
                      <Icon className={`h-4 w-4 ${textColor}`} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-brand-charcoal">{item.label}</p>
                      <p className="text-xs text-zinc-400">{item.count} pedidos · {percent}% recebido</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-black text-brand-charcoal">
                    {currency.format(item.total)}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-brand-red" style={{ width: `${Math.min(percent, 100)}%` }} />
                </div>
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
      <CardContent className="p-4">
        <h2 className="text-sm font-black text-brand-charcoal">Status dos pedidos</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {nonEmpty.length === 0 ? (
            <p className="col-span-full rounded-lg bg-zinc-50 p-3 text-sm text-zinc-400">
              Nenhum pedido registrado.
            </p>
          ) : (
            nonEmpty.map((item) => (
              <div key={item.status} className={`rounded-xl border p-3 ${statusColor(item.status)}`}>
                <p className="text-[11px] font-semibold uppercase leading-snug text-zinc-500">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-black text-brand-charcoal">{item.count}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PendingOrdersSection({ orders }: { orders: PendingOrder[] }) {
  return (
    <Card className={orders.length > 0 ? "border-amber-200 bg-amber-50/50" : ""}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-black text-brand-charcoal">Pedidos pendentes</h2>
          <Badge variant={orders.length > 0 ? "warning" : "secondary"}>{orders.length}</Badge>
        </div>
        {orders.length === 0 ? (
          <p className="rounded-xl bg-white/70 p-3 text-sm font-medium text-zinc-500">
            Nenhum pedido com pagamento pendente.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {orders.map((order) => (
                <div key={order.id} className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-brand-charcoal">Pedido #{order.daily_number}</p>
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
            </div>
            <Link
              href="/app/pedidos"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-100 text-sm font-bold text-amber-900 transition-colors hover:bg-amber-200 active:scale-[0.97]"
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
  const maxQuantity = Math.max(...products.map((product) => product.quantity), 1);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-brand-amber" />
          <h2 className="text-sm font-black text-brand-charcoal">Mais vendidos hoje</h2>
        </div>
        {products.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-400">
            Sem itens vendidos em pedidos não cancelados.
          </p>
        ) : (
          products.map((product, index) => (
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
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-brand-red" style={{ width: `${(product.quantity / maxQuantity) * 100}%` }} />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AttentionRow({
  label,
  value,
  count,
  tone,
}: {
  label: string;
  value: string;
  count: number;
  tone: "amber" | "red" | "violet" | "zinc";
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    zinc: "bg-zinc-50 text-zinc-700 border-zinc-100",
  };

  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${tones[tone]}`}>
      <div>
        <p className="text-sm font-black text-brand-charcoal">{label}</p>
        <p className="text-xs font-semibold opacity-75">{count} registros</p>
      </div>
      <p className="text-sm font-black">{value}</p>
    </div>
  );
}

interface CashInsight {
  title: string;
  description: string;
  className: string;
}

function buildCashInsights(data: CaixaData): CashInsight[] {
  const bestPayment = data.paymentBreakdown
    .filter((item) => item.method !== "PENDING" && item.method !== "COURTESY")
    .sort((a, b) => b.total - a.total)[0];
  const topProduct = data.topProducts[0];
  const pendingRate =
    data.summary.totalPedidos > 0
      ? Math.round((data.summary.pedidosPendentes / data.summary.totalPedidos) * 100)
      : 0;

  return [
    {
      title: "Pagamento líder",
      description: bestPayment
        ? `${bestPayment.label} é o meio mais usado hoje, com ${currency.format(bestPayment.total)} em ${bestPayment.count} pedidos.`
        : "Ainda não há pagamento recebido para identificar o canal principal.",
      className: "border-teal-100 bg-teal-50/70",
    },
    {
      title: "Produto motor",
      description: topProduct
        ? `${topProduct.name} lidera o dia com ${topProduct.quantity} unidades e ${currency.format(topProduct.revenue)}.`
        : "Sem produto líder por enquanto.",
      className: "border-amber-100 bg-amber-50/70",
    },
    {
      title: "Risco de caixa",
      description:
        pendingRate > 0
          ? `${pendingRate}% dos pedidos ainda têm pagamento pendente. Priorize a baixa antes do fechamento.`
          : "Nenhum pagamento pendente no momento.",
      className: pendingRate > 0 ? "border-red-100 bg-red-50/70" : "border-emerald-100 bg-emerald-50/70",
    },
  ];
}

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
