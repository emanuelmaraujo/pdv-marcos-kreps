"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  CheckCircle2,
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
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
  Zap,
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

  // insights are computed inline inside InsightGrid using data directly
  const lastUpdate = data?.generatedAt
    ? timeFormatter.format(new Date(data.generatedAt))
    : null;

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-zinc-200 bg-background px-4 pt-4 md:px-6">
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
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
                <ManagementOverview data={data} />
                <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Recebido" value={currency.format(data.summary.totalRecebido)} sub={`${data.summary.pedidosPagos} pedidos pagos`} icon={TrendingUp} tone="emerald" />
                  <MetricCard label="Pendente" value={currency.format(data.summary.totalPendente)} sub={`${data.summary.pedidosPendentes} pedidos`} icon={Clock} tone="amber" />
                  <MetricCard label="Ticket médio" value={currency.format(data.summary.ticketMedio)} sub="Recebido / pagos" icon={CreditCard} tone="blue" hidden={data.role === "ATTENDANT"} />
                  <MetricCard label="Pedidos" value={String(data.summary.totalPedidos)} sub={`${data.summary.pedidosCancelados} cancelados`} icon={ShoppingBag} tone="zinc" />
                </section>
                <InsightGrid data={data} />
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
              <div className="space-y-5">
                <SalesManagementSection data={data} />
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
                  <TopProductsSection products={data.topProducts} />
                  <StatusBreakdownSection items={data.statusBreakdown} />
                </div>
              </div>
            )}

            {activeTab === "attention" && (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <PendingOrdersSection orders={data.pendingOrders} />
                <ClosingChecklist data={data} />
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

function ManagementOverview({ data }: { data: CaixaData }) {
  const totalOrders = data.summary.totalPedidos || 1;
  const nonCancelled = Math.max(data.summary.totalPedidos - data.summary.pedidosCancelados, 1);
  const paidRate = Math.round((data.summary.pedidosPagos / totalOrders) * 100);
  const cancelRate = Math.round((data.summary.pedidosCancelados / totalOrders) * 100);
  const pendingRisk = data.summary.totalPendente + data.summary.totalCancelado;
  const bestPayment = data.paymentBreakdown
    .filter((item) => item.method !== "PENDING" && item.method !== "COURTESY")
    .sort((a, b) => b.total - a.total)[0];
  const paymentShare =
    bestPayment && data.summary.totalRecebido > 0
      ? Math.round((bestPayment.total / data.summary.totalRecebido) * 100)
      : 0;
  const topProduct = data.topProducts[0];
  const topProductShare =
    topProduct && data.summary.totalBruto > 0
      ? Math.round((topProduct.revenue / data.summary.totalBruto) * 100)
      : 0;

  return (
    <Card className="border-zinc-200">
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-zinc-400">
              Painel gerencial
            </p>
            <h2 className="text-lg font-black text-brand-charcoal">
              Leituras rápidas para decidir agora
            </h2>
          </div>
          <p className="text-xs font-semibold text-zinc-400">
            {data.summary.totalPedidos} pedidos · {nonCancelled} válidos
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ManagementKpi
            icon={CheckCircle2}
            label="Saúde do caixa"
            value={`${paidRate}% pagos`}
            detail={`${data.summary.pedidosPendentes} pendentes · ${cancelRate}% cancelados`}
            tone={paidRate >= 90 ? "emerald" : "amber"}
          />
          <ManagementKpi
            icon={AlertTriangle}
            label="Receita em risco"
            value={currency.format(pendingRisk)}
            detail="Pendente + cancelado no dia"
            tone={pendingRisk > 0 ? "red" : "emerald"}
          />
          <ManagementKpi
            icon={CreditCard}
            label="Dependência de pagamento"
            value={bestPayment ? `${bestPayment.label} ${paymentShare}%` : "Sem dados"}
            detail={
              paymentShare >= 70
                ? "Alta concentração em um meio"
                : "Distribuição saudável"
            }
            tone={paymentShare >= 70 ? "amber" : "blue"}
          />
          <ManagementKpi
            icon={Target}
            label="Produto líder"
            value={topProduct ? `${topProduct.quantity} un.` : "Sem vendas"}
            detail={
              topProduct
                ? `${topProduct.name} · ${topProductShare}% do bruto`
                : "Aguardando vendas"
            }
            tone="zinc"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ManagementKpi({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
  tone: "amber" | "blue" | "emerald" | "red" | "zinc";
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    red: "bg-red-50 text-red-700 border-red-100",
    zinc: "bg-zinc-50 text-zinc-700 border-zinc-100",
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-wide opacity-75">
          {label}
        </p>
        <Icon className="h-4 w-4 shrink-0" />
      </div>
      <p className="text-xl font-black text-brand-charcoal">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs font-semibold opacity-80">{detail}</p>
    </div>
  );
}

function SalesManagementSection({ data }: { data: CaixaData }) {
  const topProductsQuantity = data.topProducts.reduce(
    (total, product) => total + product.quantity,
    0,
  );
  const topProductsRevenue = data.topProducts.reduce(
    (total, product) => total + product.revenue,
    0,
  );
  const validOrders = Math.max(data.summary.totalPedidos - data.summary.pedidosCancelados, 1);
  const avgItemsPerOrder = topProductsQuantity / validOrders;
  const top5Share =
    data.summary.totalBruto > 0
      ? Math.round((topProductsRevenue / data.summary.totalBruto) * 100)
      : 0;

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <MetricCard
        label="Itens no top 5"
        value={String(topProductsQuantity)}
        sub={`${avgItemsPerOrder.toFixed(1)} itens por pedido válido`}
        icon={ShoppingBag}
        tone="zinc"
      />
      <MetricCard
        label="Concentração top 5"
        value={`${top5Share}%`}
        sub={`${currency.format(topProductsRevenue)} do bruto`}
        icon={Target}
        tone={top5Share >= 70 ? "amber" : "blue"}
      />
      <MetricCard
        label="Produtos com saída"
        value={String(data.topProducts.length)}
        sub="Ranking exibido no caixa do dia"
        icon={Trophy}
        tone="emerald"
      />
    </section>
  );
}

function ClosingChecklist({ data }: { data: CaixaData }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <h2 className="text-sm font-black text-brand-charcoal">
              Checklist de fechamento
            </h2>
            <p className="text-xs text-zinc-400">
              Pontos que merecem conferência antes de encerrar o caixa.
            </p>
          </div>
          <ChecklistItem
            ok={data.summary.pedidosPendentes === 0}
            label="Baixar pagamentos pendentes"
            detail={`${data.summary.pedidosPendentes} pedidos · ${currency.format(data.summary.totalPendente)}`}
          />
          <ChecklistItem
            ok={data.summary.pedidosCancelados === 0}
            label="Revisar cancelamentos"
            detail={`${data.summary.pedidosCancelados} pedidos · ${currency.format(data.summary.totalCancelado)}`}
          />
          <ChecklistItem
            ok={data.summary.pedidosComDesconto === 0}
            label="Conferir descontos"
            detail={`${data.summary.pedidosComDesconto} pedidos · ${currency.format(data.summary.totalDescontos)}`}
          />
          <ChecklistItem
            ok={data.summary.pedidosCortesia === 0}
            label="Validar cortesias"
            detail={`${data.summary.pedidosCortesia} pedidos · ${currency.format(data.summary.totalCortesia)}`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <AttentionRow label="Pagamentos pendentes" value={currency.format(data.summary.totalPendente)} count={data.summary.pedidosPendentes} tone="amber" />
          <AttentionRow label="Cancelamentos" value={currency.format(data.summary.totalCancelado)} count={data.summary.pedidosCancelados} tone="red" />
          <AttentionRow label="Descontos aplicados" value={currency.format(data.summary.totalDescontos)} count={data.summary.pedidosComDesconto} tone="zinc" />
          <AttentionRow label="Cortesias" value={currency.format(data.summary.totalCortesia)} count={data.summary.pedidosCortesia} tone="violet" />
        </CardContent>
      </Card>
    </div>
  );
}

function ChecklistItem({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-brand-charcoal">{label}</p>
        <p className="text-xs font-semibold text-zinc-400">{detail}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
          ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
        }`}
      >
        {ok ? "OK" : "Verificar"}
      </span>
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

interface CashInsightCard {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  tone: "teal" | "amber" | "red" | "emerald" | "blue" | "violet";
}

function InsightGrid({ data }: { data: CaixaData }) {
  const bestPayment = data.paymentBreakdown
    .filter((i) => i.method !== "PENDING" && i.method !== "COURTESY")
    .sort((a, b) => b.total - a.total)[0];

  const topProduct = data.topProducts[0];

  const peakHourLabel = data.summary.horaDePico !== null
    ? `${String(data.summary.horaDePico).padStart(2, "0")}h–${String((data.summary.horaDePico + 1) % 24).padStart(2, "0")}h`
    : null;

  const cards: CashInsightCard[] = [
    {
      title: "Pagamento líder",
      value: bestPayment ? bestPayment.label : "—",
      description: bestPayment
        ? `${currency.format(bestPayment.total)} em ${bestPayment.count} pedidos`
        : "Nenhum pagamento recebido ainda",
      icon: TrendingUp,
      tone: "teal",
    },
    {
      title: "Produto motor",
      value: topProduct ? `${topProduct.quantity} un.` : "—",
      description: topProduct
        ? `${topProduct.name} · ${currency.format(topProduct.revenue)}`
        : "Sem produto líder ainda",
      icon: Trophy,
      tone: "amber",
    },
    {
      title: "Taxa de cancelamento",
      value: `${data.summary.taxaCancelamento}%`,
      description: `${data.summary.pedidosCancelados} de ${data.summary.totalPedidos} pedidos cancelados`,
      icon: data.summary.taxaCancelamento > 10 ? TrendingDown : CheckCircle2,
      tone: data.summary.taxaCancelamento > 10 ? "red" : "emerald",
    },
    {
      title: "Hora de pico",
      value: peakHourLabel ?? "—",
      description: peakHourLabel
        ? "Período com maior concentração de pedidos"
        : "Dados insuficientes para calcular",
      icon: Zap,
      tone: "violet",
    },
    {
      title: "Risco de caixa",
      value: currency.format(data.summary.totalPendente),
      description: `${data.summary.pedidosPendentes} ${data.summary.pedidosPendentes === 1 ? "pedido pendente" : "pedidos pendentes"} sem baixa`,
      icon: AlertTriangle,
      tone: data.summary.pedidosPendentes > 0 ? "red" : "emerald",
    },
    {
      title: "Ticket médio",
      value: currency.format(data.summary.ticketMedio),
      description: `Calculado sobre ${data.summary.pedidosPagos} pedidos pagos`,
      icon: CreditCard,
      tone: "blue",
    },
  ];

  const toneStyles: Record<string, string> = {
    teal:    "border-teal-100 bg-teal-50/70 text-teal-600",
    amber:   "border-amber-100 bg-amber-50/70 text-amber-600",
    red:     "border-red-100 bg-red-50/70 text-red-600",
    emerald: "border-emerald-100 bg-emerald-50/70 text-emerald-600",
    blue:    "border-blue-100 bg-blue-50/70 text-blue-600",
    violet:  "border-violet-100 bg-violet-50/70 text-violet-600",
  };

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        const style = toneStyles[card.tone];
        return (
          <Card key={card.title} className={`border ${style.split(" ").slice(0, 2).join(" ")}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{card.title}</p>
                <span className={`rounded-lg p-1.5 ${style.split(" ").slice(0, 2).join(" ")}`}>
                  <Icon className={`h-3.5 w-3.5 ${style.split(" ")[2]}`} />
                </span>
              </div>
              <p className={`text-2xl font-black leading-tight ${style.split(" ")[2]}`}>{card.value}</p>
              <p className="mt-1.5 text-xs font-semibold text-zinc-500 leading-snug">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}
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
