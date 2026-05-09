"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Filter,
  Gift,
  Hash,
  Lightbulb,
  ListOrdered,
  Percent,
  Pizza,
  QrCode,
  RefreshCw,
  Search,
  TrendingUp,
  Trophy,
  Utensils,
  XCircle,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  CashReportFilters,
  CashReportResponse,
  CategoryStat,
  OrderRecord,
  ProductStat,
  reportsApi,
} from "@/lib/api/reports-api";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

type Period = "today" | "yesterday" | "last7" | "last30" | "thisMonth";

const periodLabels: Record<Period, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  last7: "7 dias",
  last30: "30 dias",
  thisMonth: "Este mês",
};

function computeDates(period: Period): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date();
  const end = new Date();
  switch (period) {
    case "yesterday":
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case "last7":
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case "last30":
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;
    case "thisMonth":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    default: // today
      start.setHours(0, 0, 0, 0);
      break;
  }
  return { start, end };
}

export default function RelatorioPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [report, setReport] = useState<CashReportResponse | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<CashReportFilters>({
    payment_method: "ALL",
    category_id: "ALL",
    start_date: "",
    end_date: "",
  });
  const [period, setPeriod] = useState<Period>("today");

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, active")
        .eq("id", user.id)
        .single();
      if (!profile || profile.role !== "ADMIN" || !profile.active) {
        setIsAdmin(false);
        router.replace("/app/caixa");
      } else {
        setIsAdmin(true);
      }
    };
    checkAdmin();
  }, [router, supabase]);

  useEffect(() => {
    if (isAdmin === true) {
      reportsApi.getCategories().then(setCategories);
    }
  }, [isAdmin]);

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const { start, end } = computeDates(period);
      const [reportData, ordersData] = await Promise.all([
        reportsApi.getCashReport({ ...filters, start_date: start.toISOString(), end_date: end.toISOString() }),
        reportsApi.getOrdersForDateRange(start.toISOString(), end.toISOString()),
      ]);
      setReport(reportData);
      setOrders(ordersData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar relatório");
    } finally {
      setIsLoading(false);
    }
  }, [period, filters]);

  useEffect(() => {
    if (isAdmin === true) loadReport();
  }, [isAdmin, loadReport]);

  const leadingPayment = useMemo(
    () => report?.payment_breakdown.filter((i) => i.count > 0).sort((a, b) => b.total - a.total)[0],
    [report],
  );

  if (isAdmin === null || (isAdmin === true && isLoading && !report)) {
    return <LoadingState message="Consolidando dados gerenciais..." />;
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <ErrorState title="Falha no relatório" message={error} onRetry={() => loadReport()} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-24">
      <main className="space-y-5 p-4 md:p-6 lg:p-8">

        {/* Control panel */}
        <ReportControlPanel
          period={period}
          filters={filters}
          categories={categories}
          isLoading={isLoading}
          onPeriodChange={setPeriod}
          onFilterChange={setFilters}
          onBack={() => router.push("/app/caixa")}
          onRefresh={loadReport}
        />

        {!report ? null : (
          <>
            {/* ── Seção 1: Resumo executivo ── */}
            <ExecutiveSummary report={report} leadingPayment={leadingPayment} />
            <OpportunityStrip report={report} leadingPayment={leadingPayment} />

            {/* ── Seção 2: Financeiro ── */}
            <SectionDivider label="Financeiro" icon={TrendingUp} />
            <FinancialCommand report={report} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Recebido líquido" value={currency.format(report.summary.received)} sub={`${report.summary.paid_orders} pedidos pagos`} tone="emerald" icon={TrendingUp} />
              <SummaryCard label="Ticket médio" value={currency.format(report.summary.average_ticket)} sub="Por pedido pago" tone="blue" icon={CreditCard} />
              <SummaryCard label="Venda bruta" value={currency.format(report.summary.gross_sales)} sub="Exceto cancelados" tone="zinc" icon={BarChart3} />
              <SummaryCard label="Pendente" value={currency.format(report.summary.pending)} sub="Aguardando baixa" tone="amber" icon={Clock} />
            </div>
            <InsightsSection insights={report.insights} />

            {/* ── Seção 3: Vendas & Produtos ── */}
            <SectionDivider label="Vendas & Produtos" icon={Trophy} />
            <CategoryPanel categories={report.category_breakdown} filtered={report.metadata.is_filtered_by_category} />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <RankingPanel title="Ranking geral" items={report.top_all_products} icon={Trophy} />
              <KrepRankings report={report} />
            </div>

            {/* ── Seção 4: Horários & Padrões ── */}
            <SectionDivider label="Horários & Padrões" icon={Zap} />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <HourlyPanel report={report} />
              <WeekdayPanel report={report} />
            </div>

            {/* ── Seção 5: Pagamentos & Atenção ── */}
            <SectionDivider label="Pagamentos & Atenção" icon={CreditCard} />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <PaymentPanel report={report} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <SummaryCard label="Descontos" value={currency.format(report.financial_attention.discount_total)} sub={`${report.financial_attention.discount_orders} pedidos`} tone="red" icon={Percent} />
                <SummaryCard label="Cortesias" value={currency.format(report.financial_attention.courtesy_total)} sub={`${report.financial_attention.courtesy_orders} pedidos`} tone="violet" icon={Gift} />
                <SummaryCard label="Cancelado" value={currency.format(report.financial_attention.canceled_total)} sub={`${report.financial_attention.canceled_orders} pedidos`} tone="zinc" icon={XCircle} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
              <LowSellingPanel report={report} />
              <AttentionPanel report={report} />
            </div>

            {/* ── Seção 6: Registro de Pedidos ── */}
            <SectionDivider label="Registro de Pedidos" icon={ListOrdered} />
            <OrdersRegistry orders={orders} />

            {report.metadata.note && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
                {report.metadata.note}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ── Control panel ─────────────────────────────────────────────────────────────

function ReportControlPanel({
  period,
  filters,
  categories,
  isLoading,
  onPeriodChange,
  onFilterChange,
  onBack,
  onRefresh,
}: {
  period: Period;
  filters: CashReportFilters;
  categories: { id: string; name: string }[];
  isLoading: boolean;
  onPeriodChange: (period: Period) => void;
  onFilterChange: (filters: CashReportFilters) => void;
  onBack: () => void;
  onRefresh: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-brand-charcoal p-4 text-white md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <button
              onClick={onBack}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 text-sm font-black text-white transition-colors hover:bg-white/15"
              aria-label="Voltar ao caixa"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Caixa</span>
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                Relatório gerencial
              </p>
              <h1 className="mt-0.5 text-xl font-black tracking-tight md:text-2xl">
                Painel de performance
              </h1>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black uppercase text-brand-charcoal shadow-sm transition-all hover:bg-zinc-100 active:scale-[0.98]"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-brand-red" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4 md:p-5">
        {/* Period selector */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {(Object.keys(periodLabels) as Period[]).map((item) => (
            <button
              key={item}
              onClick={() => onPeriodChange(item)}
              className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-xs font-black transition-all ${
                period === item
                  ? "bg-brand-red text-white shadow-sm"
                  : "border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              {periodLabels[item]}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-400">
              Categoria
            </label>
            <Select
              value={filters.category_id}
              onChange={(e) => onFilterChange({ ...filters, category_id: e.target.value })}
              className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm font-bold"
            >
              <option value="ALL">Todas as categorias</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-400">
              Pagamento
            </label>
            <Select
              value={filters.payment_method}
              onChange={(e) => onFilterChange({ ...filters, payment_method: e.target.value })}
              className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm font-bold"
            >
              <option value="ALL">Todos</option>
              <option value="PIX">PIX</option>
              <option value="CASH">Dinheiro</option>
              <option value="DEBIT_CARD">Débito</option>
              <option value="CREDIT_CARD">Crédito</option>
              <option value="COURTESY">Cortesia</option>
            </Select>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────

function SectionDivider({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-charcoal">
        <Icon className="h-3.5 w-3.5 text-white" />
      </span>
      <p className="text-sm font-black uppercase tracking-widest text-slate-500">{label}</p>
      <div className="flex-1 border-t border-slate-200" />
    </div>
  );
}

// ── Executive summary ─────────────────────────────────────────────────────────

function ExecutiveSummary({
  report,
  leadingPayment,
}: {
  report: CashReportResponse;
  leadingPayment?: CashReportResponse["payment_breakdown"][number];
}) {
  const topProduct = report.top_all_products[0];
  const peakHour = [...report.hourly_sales].sort((a, b) => b.orders - a.orders)[0];
  const paidRate =
    report.summary.total_orders > 0
      ? Math.round((report.summary.paid_orders / report.summary.total_orders) * 100)
      : 0;

  return (
    <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1.15fr_0.85fr_0.85fr]">
      <Card className="overflow-hidden border-0 bg-brand-charcoal text-white">
        <CardContent className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                Faturamento recebido
              </p>
              <p className="mt-2 text-4xl font-black tracking-tight">
                {currency.format(report.summary.received)}
              </p>
              <p className="mt-2 text-sm text-zinc-300">
                {report.summary.paid_orders} pagos · {paidRate}% de conversão
              </p>
            </div>
            <span className="rounded-2xl bg-white/10 p-3">
              <TrendingUp className="h-6 w-6 text-emerald-400" />
            </span>
          </div>
        </CardContent>
      </Card>
      <HighlightCard
        title="Pagamento dominante"
        value={leadingPayment ? paymentLabel(leadingPayment.method) : "Sem dados"}
        sub={leadingPayment ? `${currency.format(leadingPayment.total)} · ${leadingPayment.count} pedidos` : "Aguardando vendas"}
        icon={paymentIcon(leadingPayment?.method)}
        tone="blue"
      />
      <HighlightCard
        title="Produto & pico"
        value={topProduct?.name ?? "Sem vendas"}
        sub={peakHour?.orders ? `${topProduct?.quantity ?? 0} un. · pico ${peakHour.range}` : "Aguardando volume"}
        icon={Trophy}
        tone="amber"
      />
    </section>
  );
}

function OpportunityStrip({
  report,
  leadingPayment,
}: {
  report: CashReportResponse;
  leadingPayment?: CashReportResponse["payment_breakdown"][number];
}) {
  const pendingRate =
    report.summary.gross_sales > 0
      ? Math.round((report.summary.pending / report.summary.gross_sales) * 100)
      : 0;
  const discountRate =
    report.summary.gross_sales > 0
      ? Math.round((report.summary.discounts / report.summary.gross_sales) * 100)
      : 0;
  const paymentShare =
    leadingPayment && report.summary.received > 0
      ? Math.round((leadingPayment.total / report.summary.received) * 100)
      : 0;
  const top3Revenue = report.top_all_products.slice(0, 3).reduce((t, p) => t + p.revenue, 0);
  const top3Share =
    report.summary.gross_sales > 0
      ? Math.round((top3Revenue / report.summary.gross_sales) * 100)
      : 0;

  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <SignalCard icon={CheckCircle2} label="Saúde do caixa" value={pendingRate === 0 ? "Em dia" : `${pendingRate}% pend.`} detail={pendingRate === 0 ? "Sem valor pendente" : "Priorize baixa"} tone={pendingRate === 0 ? "emerald" : "amber"} />
      <SignalCard icon={Trophy} label="Concentração top 3" value={`${top3Share}%`} detail={top3Share >= 70 ? "Alta dependência" : "Mix saudável"} tone={top3Share >= 70 ? "amber" : "blue"} />
      <SignalCard icon={CreditCard} label="Meio líder" value={leadingPayment ? `${paymentShare}%` : "—"} detail={leadingPayment ? paymentLabel(leadingPayment.method) : "Aguardando"} tone={paymentShare >= 75 ? "amber" : "zinc"} />
      <SignalCard icon={Percent} label="Desconto/bruto" value={`${discountRate}%`} detail={currency.format(report.summary.discounts)} tone={discountRate > 10 ? "red" : "zinc"} />
    </section>
  );
}

// ── Financial ─────────────────────────────────────────────────────────────────

function FinancialCommand({ report }: { report: CashReportResponse }) {
  const netAfterAttention =
    report.summary.received -
    report.financial_attention.discount_total -
    report.financial_attention.courtesy_total;
  const riskTotal = report.summary.pending + report.summary.canceled;

  return (
    <Card className="border-slate-200">
      <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3 md:p-5">
        <CommandMetric label="Potencial líquido" value={currency.format(Math.max(netAfterAttention, 0))} detail="Recebido menos descontos e cortesias" />
        <CommandMetric label="Receita em risco" value={currency.format(riskTotal)} detail="Pendente + cancelado" />
        <CommandMetric label="Pedidos totais" value={String(report.summary.total_orders)} detail={`${report.summary.paid_orders} pagos no período`} />
      </CardContent>
    </Card>
  );
}

function InsightsSection({ insights }: { insights: CashReportResponse["insights"] }) {
  if (insights.length === 0) return null;
  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {insights.map((insight) => (
        <Card key={insight.title} className={insightTone(insight.severity)}>
          <CardContent className="flex gap-3 p-4">
            <span className="mt-0.5 shrink-0 rounded-xl bg-white/70 p-2">
              {insight.severity === "warning" || insight.severity === "negative" ? (
                <AlertCircle className="h-4 w-4 text-red-600" />
              ) : insight.severity === "positive" ? (
                <Trophy className="h-4 w-4 text-emerald-600" />
              ) : (
                <Lightbulb className="h-4 w-4 text-blue-600" />
              )}
            </span>
            <div>
              <p className="text-sm font-black text-slate-900">{insight.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{insight.description}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

// ── Vendas & Produtos ─────────────────────────────────────────────────────────

function CategoryPanel({ categories, filtered }: { categories: CategoryStat[]; filtered: boolean }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <PanelTitle icon={Hash} title="Categorias que mais vendem" />
          {filtered && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-700">
              Recorte ativo
            </span>
          )}
        </div>
        {categories.length === 0 ? (
          <EmptyPanel text="Sem dados no período." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((cat) => (
              <div key={cat.category_name} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{cat.category_name}</p>
                    <p className="text-xs font-medium text-slate-400">{cat.quantity} un. · {cat.orders_count} pedidos</p>
                  </div>
                  <CategoryIcon name={cat.category_name} />
                </div>
                <p className="mt-3 text-lg font-black text-slate-900">{currency.format(cat.revenue)}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-red" style={{ width: `${Math.min(cat.percent, 100)}%` }} />
                </div>
                <p className="mt-1 text-[10px] font-bold text-slate-400">{cat.percent.toFixed(1)}% do faturamento</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RankingPanel({
  title,
  items,
  icon,
  empty = "Sem dados no período.",
}: {
  title: string;
  items: ProductStat[];
  icon: React.ElementType;
  empty?: string;
}) {
  const Icon = icon;
  const maxQty = Math.max(...items.map((i) => i.quantity), 1);
  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-3 p-4">
        <PanelTitle icon={Icon} title={title} />
        {items.length === 0 ? (
          <EmptyPanel text={empty} />
        ) : (
          <div className="divide-y divide-slate-100">
            {items.slice(0, 10).map((item, index) => (
              <div key={`${item.name}-${index}`} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{item.name}</p>
                      <p className="text-xs font-medium text-slate-400">{item.category}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-slate-900">{item.quantity} un.</p>
                    <p className="text-xs font-bold text-brand-red">{currency.format(item.revenue)}</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-red" style={{ width: `${(item.quantity / maxQty) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KrepRankings({ report }: { report: CashReportResponse }) {
  return (
    <div className="grid grid-cols-1 gap-5">
      <RankingPanel title="Kreps salgados" items={report.category_rankings.savory_kreps} icon={Pizza} empty="Sem kreps salgados no período." />
      <RankingPanel title="Kreps doces" items={report.category_rankings.sweet_kreps} icon={Utensils} empty="Sem kreps doces no período." />
    </div>
  );
}

// ── Horários & Padrões ────────────────────────────────────────────────────────

function HourlyPanel({ report }: { report: CashReportResponse }) {
  const maxOrders = Math.max(...report.hourly_sales.map((i) => i.orders), 1);
  return (
    <Card className="border-slate-200">
      <CardContent className="p-4">
        <PanelTitle icon={Zap} title="Pedidos por horário" />
        <div className="mt-6 flex h-48 items-end gap-1.5 border-b border-slate-100 px-1 sm:gap-2">
          {report.hourly_sales.map((hour) => {
            const height = hour.orders > 0 ? Math.max((hour.orders / maxOrders) * 100, 8) : 2;
            const isPeak = hour.orders === maxOrders && hour.orders > 0;
            return (
              <div key={hour.range} className="flex h-full flex-1 flex-col justify-end gap-1">
                {hour.orders > 0 && (
                  <div className="text-center text-[9px] font-black text-slate-500">{hour.orders}</div>
                )}
                <div
                  className={`rounded-t-md ${isPeak ? "bg-brand-red" : "bg-slate-300"}`}
                  style={{ height: `${height}%` }}
                  title={`${hour.range}: ${hour.orders} pedidos`}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex overflow-x-auto hide-scrollbar">
          {report.hourly_sales.map((hour) => (
            <div key={hour.range} className="flex-1 text-center text-[9px] font-bold text-slate-400 whitespace-nowrap">
              {hour.range.split("h")[0]}h
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs font-medium text-slate-400">
          Barra vermelha = hora de pico. Passe o cursor para ver detalhes.
        </p>
      </CardContent>
    </Card>
  );
}

function WeekdayPanel({ report }: { report: CashReportResponse }) {
  const maxReceived = Math.max(...report.weekday_sales.map((i) => i.received), 1);
  const best = [...report.weekday_sales].sort((a, b) => b.received - a.received)[0];
  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <PanelTitle icon={CalendarDays} title="Dia da semana" />
          {best?.weekday && (
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">
              Melhor: {best.weekday}
            </span>
          )}
        </div>
        {report.weekday_sales.map((day) => {
          const isBest = day.weekday === best?.weekday;
          return (
            <div key={day.weekday} className={`rounded-xl border p-3 ${isBest ? "border-emerald-200 bg-emerald-50" : "border-slate-100"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">{day.weekday}</p>
                  <p className="text-xs font-medium text-slate-400">
                    {day.orders} pedidos · ticket {currency.format(day.average_ticket)}
                  </p>
                </div>
                <p className="text-sm font-black text-slate-900">{currency.format(day.received)}</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${isBest ? "bg-emerald-500" : "bg-brand-charcoal"}`}
                  style={{ width: `${(day.received / maxReceived) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ── Pagamentos & Atenção ──────────────────────────────────────────────────────

function PaymentPanel({ report }: { report: CashReportResponse }) {
  const items = report.payment_breakdown.filter((i) => i.count > 0);
  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-3 p-4">
        <PanelTitle icon={CreditCard} title="Meios de pagamento" />
        {items.length === 0 ? (
          <EmptyPanel text="Nenhum pagamento no período." />
        ) : (
          items.map((item) => {
            const Icon = paymentIcon(item.method);
            return (
              <div key={item.method} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="rounded-lg bg-slate-50 p-2 text-slate-600">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{paymentLabel(item.method)}</p>
                      <p className="text-xs font-medium text-slate-400">{item.count} pedidos · {item.percent.toFixed(1)}%</p>
                    </div>
                  </div>
                  <p className="text-sm font-black text-slate-900">{currency.format(item.total)}</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-red" style={{ width: `${Math.min(item.percent, 100)}%` }} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function LowSellingPanel({ report }: { report: CashReportResponse }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-3 p-4">
        <PanelTitle icon={AlertCircle} title="Produtos sem saída" />
        {report.low_selling_products.length === 0 ? (
          <EmptyPanel text="Todos os produtos ativos tiveram venda no período." />
        ) : (
          report.low_selling_products.map((item) => (
            <div key={item.product_id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{item.name}</p>
                <p className="text-xs font-medium text-slate-400">{item.category}</p>
              </div>
              <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-500">
                0 vendas
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AttentionPanel({ report }: { report: CashReportResponse }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-3 p-4">
        <PanelTitle icon={Filter} title="Auditoria financeira" />
        <AttentionRow icon={Percent} label="Descontos concedidos" value={currency.format(report.financial_attention.discount_total)} count={report.financial_attention.discount_orders} tone="red" />
        <AttentionRow icon={Gift} label="Pedidos em cortesia" value={currency.format(report.financial_attention.courtesy_total)} count={report.financial_attention.courtesy_orders} tone="violet" />
        <AttentionRow icon={XCircle} label="Cancelamentos" value={currency.format(report.financial_attention.canceled_total)} count={report.financial_attention.canceled_orders} tone="zinc" />
      </CardContent>
    </Card>
  );
}

// ── Registro de Pedidos ───────────────────────────────────────────────────────

type OrderFilter = "TODOS" | "PAGOS" | "PENDENTES" | "CANCELADOS";

function OrdersRegistry({ orders }: { orders: OrderRecord[] }) {
  const [filter, setFilter] = useState<OrderFilter>("TODOS");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  const filtered = useMemo(() => {
    let result = orders;
    if (filter === "PAGOS") result = result.filter((o) => o.payment_status === "PAID");
    else if (filter === "PENDENTES") result = result.filter((o) => o.payment_status === "PENDING" && o.status !== "CANCELADO");
    else if (filter === "CANCELADOS") result = result.filter((o) => o.status === "CANCELADO");
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((o) => String(o.daily_number).padStart(3, "0").includes(q));
    }
    return result;
  }, [orders, filter, search]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  const filters: { key: OrderFilter; label: string; count: number }[] = [
    { key: "TODOS", label: "Todos", count: orders.length },
    { key: "PAGOS", label: "Pagos", count: orders.filter((o) => o.payment_status === "PAID").length },
    { key: "PENDENTES", label: "Pendentes", count: orders.filter((o) => o.payment_status === "PENDING" && o.status !== "CANCELADO").length },
    { key: "CANCELADOS", label: "Cancelados", count: orders.filter((o) => o.status === "CANCELADO").length },
  ];

  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <PanelTitle icon={ListOrdered} title="Registro de pedidos" />
          <span className="text-xs font-bold text-slate-400">{filtered.length} de {orders.length} pedidos</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por número do pedido..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-red focus:outline-none focus:ring-0"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(1); }}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-black transition-all ${
                filter === f.key
                  ? "bg-brand-charcoal text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${filter === f.key ? "bg-white/20" : "bg-white text-slate-600"}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Orders list */}
        {filtered.length === 0 ? (
          <EmptyPanel text="Nenhum pedido encontrado com esse filtro." />
        ) : (
          <div className="divide-y divide-slate-100">
            {paginated.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        )}

        {hasMore && (
          <button
            onClick={() => setPage((p) => p + 1)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-black text-slate-600 transition-colors hover:bg-slate-100"
          >
            Carregar mais ({filtered.length - paginated.length} restantes)
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function OrderRow({ order }: { order: OrderRecord }) {
  const statusConfig: Record<string, { label: string; cls: string }> = {
    NA_FILA: { label: "Na fila", cls: "bg-blue-100 text-blue-700" },
    PRONTO: { label: "Pronto", cls: "bg-emerald-100 text-emerald-700" },
    ENTREGUE: { label: "Entregue", cls: "bg-slate-100 text-slate-600" },
    CANCELADO: { label: "Cancelado", cls: "bg-red-100 text-red-700" },
    AGUARDANDO_CONFIRMACAO: { label: "Aguardando", cls: "bg-amber-100 text-amber-700" },
    AGUARDANDO_PAGAMENTO: { label: "Ag. pagamento", cls: "bg-amber-100 text-amber-700" },
    EXPIRADO: { label: "Expirado", cls: "bg-slate-100 text-slate-500" },
  };
  const paymentConfig: Record<string, { label: string; icon: React.ElementType }> = {
    PIX: { label: "PIX", icon: QrCode },
    CASH: { label: "Dinheiro", icon: Banknote },
    DEBIT_CARD: { label: "Débito", icon: CreditCard },
    CREDIT_CARD: { label: "Crédito", icon: CreditCard },
    COURTESY: { label: "Cortesia", icon: Gift },
    PENDING: { label: "Pendente", icon: Clock },
  };
  const st = statusConfig[order.status] ?? { label: order.status, cls: "bg-slate-100 text-slate-600" };
  const pm = paymentConfig[order.payment_method] ?? { label: order.payment_method, icon: CreditCard };
  const PayIcon = pm.icon;
  const hasDiscount = order.discount_amount != null && order.discount_amount > 0;

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">
        #{String(order.daily_number).padStart(3, "0")}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${st.cls}`}>
            {st.label}
          </span>
          {hasDiscount && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-600">
              -{currency.format(order.discount_amount!)}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          {dateFormatter.format(new Date(order.created_at))} · {timeFormatter.format(new Date(order.created_at))}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-black text-slate-900">{currency.format(order.total_amount)}</p>
        <div className="mt-0.5 flex items-center justify-end gap-1 text-xs text-slate-400">
          <PayIcon className="h-3 w-3" />
          <span>{pm.label}</span>
        </div>
      </div>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function HighlightCard({ title, value, sub, icon: Icon, tone }: { title: string; value: string; sub: string; icon: React.ElementType; tone: "amber" | "blue" }) {
  const toneClass = tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600";
  return (
    <Card className="border-slate-200">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p>
          <p className="mt-2 truncate text-xl font-black text-slate-900">{value}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">{sub}</p>
        </div>
        <span className={`rounded-xl p-3 ${toneClass}`}><Icon className="h-5 w-5" /></span>
      </CardContent>
    </Card>
  );
}

function SignalCard({ icon: Icon, label, value, detail, tone }: { icon: React.ElementType; label: string; value: string; detail: string; tone: "amber" | "blue" | "emerald" | "red" | "zinc" }) {
  const tones = {
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    red: "border-red-100 bg-red-50 text-red-700",
    zinc: "border-slate-100 bg-white text-slate-700",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-wide opacity-75">{label}</p>
        <Icon className="h-4 w-4 shrink-0" />
      </div>
      <p className="text-xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold opacity-80 leading-snug">{detail}</p>
    </div>
  );
}

function SummaryCard({ label, value, sub, tone, icon: Icon }: { label: string; value: string; sub: string; tone: "amber" | "blue" | "emerald" | "red" | "violet" | "zinc"; icon: React.ElementType }) {
  const tones = {
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
    violet: "bg-violet-50 text-violet-600",
    zinc: "bg-slate-100 text-slate-700",
  };
  return (
    <Card className="border-slate-200">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
          <span className={`rounded-lg p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
        </div>
        <p className="text-2xl font-black text-slate-950">{value}</p>
        <p className="mt-1 text-xs font-medium text-slate-400">{sub}</p>
      </CardContent>
    </Card>
  );
}

function CommandMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function AttentionRow({ icon: Icon, label, value, count, tone }: { icon: React.ElementType; label: string; value: string; count: number; tone: "red" | "violet" | "zinc" }) {
  const tones = { red: "bg-red-50 text-red-600", violet: "bg-violet-50 text-violet-600", zinc: "bg-slate-100 text-slate-600" };
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`rounded-xl p-2.5 ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-900">{label}</p>
          <p className="text-xs font-medium text-slate-400">{count} registros</p>
        </div>
      </div>
      <p className="shrink-0 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function PanelTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-brand-red" />
      <h2 className="text-sm font-black text-slate-900">{title}</h2>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <p className="rounded-xl bg-slate-50 p-4 text-sm font-medium text-slate-400">{text}</p>;
}

function CategoryIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  let Icon = Hash;
  if (lower.includes("salgado")) Icon = Pizza;
  else if (lower.includes("doce")) Icon = Utensils;
  else if (lower.includes("suco") || lower.includes("refrigerante")) Icon = Zap;
  else if (lower.includes("creme") || lower.includes("açaí") || lower.includes("acai")) Icon = Gift;
  return (
    <span className="rounded-xl bg-red-50 p-2 text-brand-red">
      <Icon className="h-4 w-4" />
    </span>
  );
}

function paymentIcon(method?: string) {
  switch (method) {
    case "PIX": return QrCode;
    case "CASH": return Banknote;
    case "DEBIT_CARD":
    case "CREDIT_CARD": return CreditCard;
    case "COURTESY": return Gift;
    default: return Zap;
  }
}

function paymentLabel(method?: string) {
  const labels: Record<string, string> = {
    ALL: "Todos", PIX: "PIX", CASH: "Dinheiro",
    DEBIT_CARD: "Débito", CREDIT_CARD: "Crédito",
    COURTESY: "Cortesia", PENDING: "Pendente",
  };
  return method ? labels[method] ?? method : "Sem dados";
}

function insightTone(severity: string) {
  if (severity === "positive") return "border-emerald-100 bg-emerald-50";
  if (severity === "warning" || severity === "negative") return "border-red-100 bg-red-50";
  return "border-blue-100 bg-blue-50";
}
