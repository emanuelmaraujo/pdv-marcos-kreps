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
  Coffee,
  CreditCard,
  Filter,
  FilterX,
  Gift,
  Hash,
  Lightbulb,
  Percent,
  Pizza,
  QrCode,
  RefreshCw,
  Target,
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
  ProductStat,
  reportsApi,
} from "@/lib/api/reports-api";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type Period = "today" | "yesterday" | "last7" | "last30" | "thisMonth";
type ReportTab = "financial" | "payments" | "sales" | "time" | "attention";

const periodLabels: Record<Period, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  last7: "7 dias",
  last30: "30 dias",
  thisMonth: "Este mês",
};

const tabLabels: Record<ReportTab, string> = {
  financial: "Financeiro",
  payments: "Pagamentos",
  sales: "Vendas",
  time: "Dias e horários",
  attention: "Atenção",
};

export default function RelatorioPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [report, setReport] = useState<CashReportResponse | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ReportTab>("financial");
  const [filters, setFilters] = useState<CashReportFilters>({
    payment_method: "ALL",
    category_id: "ALL",
    start_date: "",
    end_date: "",
  });
  const [period, setPeriod] = useState<Period>("today");

  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

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
      const now = new Date();
      const start = new Date();
      const end = new Date();

      switch (period) {
        case "today":
          start.setHours(0, 0, 0, 0);
          break;
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
      }

      const data = await reportsApi.getCashReport({
        ...filters,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
      });
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar relatório");
    } finally {
      setIsLoading(false);
    }
  }, [period, filters]);

  useEffect(() => {
    if (isAdmin === true) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadReport();
    }
  }, [isAdmin, loadReport]);

  const leadingPayment = useMemo(() => {
    return report?.payment_breakdown
      .filter((item) => item.count > 0)
      .sort((a, b) => b.total - a.total)[0];
  }, [report]);

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
        <ReportControlPanel
          period={period}
          filters={filters}
          categories={categories}
          isLoading={isLoading}
          activeTab={activeTab}
          onPeriodChange={setPeriod}
          onFilterChange={setFilters}
          onTabChange={setActiveTab}
          onBack={() => router.push("/app/caixa")}
          onRefresh={loadReport}
        />

        {!report ? null : (
          <>
            <ExecutiveSummary report={report} leadingPayment={leadingPayment} />
            <OpportunityStrip report={report} leadingPayment={leadingPayment} />

            {activeTab === "financial" && (
              <div className="space-y-5">
                <FinancialCommand report={report} />
                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard label="Recebido líquido" value={currency.format(report.summary.received)} sub={`${report.summary.paid_orders} pedidos pagos`} tone="emerald" icon={TrendingUp} />
                  <SummaryCard label="Ticket médio" value={currency.format(report.summary.average_ticket)} sub="Por pedido pago" tone="blue" icon={CreditCard} />
                  <SummaryCard label="Venda bruta" value={currency.format(report.summary.gross_sales)} sub="Exceto cancelados" tone="zinc" icon={BarChart3} />
                  <SummaryCard label="Pendente" value={currency.format(report.summary.pending)} sub="Aguardando baixa" tone="amber" icon={Clock} />
                </section>
                <InsightsSection insights={report.insights} />
              </div>
            )}

            {activeTab === "payments" && (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                <PaymentPanel report={report} />
                <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <SummaryCard label="Descontos" value={currency.format(report.financial_attention.discount_total)} sub={`${report.financial_attention.discount_orders} pedidos`} tone="red" icon={Percent} />
                  <SummaryCard label="Cortesias" value={currency.format(report.financial_attention.courtesy_total)} sub={`${report.financial_attention.courtesy_orders} pedidos`} tone="violet" icon={Gift} />
                  <SummaryCard label="Cancelado" value={currency.format(report.financial_attention.canceled_total)} sub={`${report.financial_attention.canceled_orders} pedidos`} tone="zinc" icon={XCircle} />
                </section>
              </div>
            )}

            {activeTab === "sales" && (
              <div className="space-y-5">
                <CategoryPanel categories={report.category_breakdown} filtered={report.metadata.is_filtered_by_category} />
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  <RankingPanel title="Ranking geral" items={report.top_all_products} icon={Trophy} />
                  <KrepRankings report={report} />
                </div>
              </div>
            )}

            {activeTab === "time" && (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <HourlyPanel report={report} />
                <WeekdayPanel report={report} />
              </div>
            )}

            {activeTab === "attention" && (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
                <LowSellingPanel report={report} />
                <AttentionPanel report={report} />
              </div>
            )}

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

function ReportControlPanel({
  period,
  filters,
  categories,
  isLoading,
  activeTab,
  onPeriodChange,
  onFilterChange,
  onTabChange,
  onBack,
  onRefresh,
}: {
  period: Period;
  filters: CashReportFilters;
  categories: { id: string; name: string }[];
  isLoading: boolean;
  activeTab: ReportTab;
  onPeriodChange: (period: Period) => void;
  onFilterChange: (filters: CashReportFilters) => void;
  onTabChange: (tab: ReportTab) => void;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const activeCategory =
    categories.find((category) => category.id === filters.category_id)?.name ??
    "Todas as categorias";
  const activePayment = paymentLabel(filters.payment_method);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-brand-charcoal p-4 text-white md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <button
              onClick={onBack}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 text-sm font-black text-white transition-colors hover:bg-white/15"
              aria-label="Voltar ao caixa"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Caixa</span>
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                Relatório gerencial
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                Painel de performance
              </h1>
              <p className="mt-1 text-sm text-zinc-300">
                Filtros, tendências e pontos de atenção para operação e caixa.
              </p>
            </div>
          </div>

          <button
            onClick={onRefresh}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black uppercase text-brand-charcoal shadow-sm transition-all hover:bg-zinc-100 active:scale-[0.98]"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-brand-red" : ""}`} />
            Atualizar dados
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4 md:p-5">
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

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-400">
              Categoria
            </label>
            <Select
              value={filters.category_id}
              onChange={(event) => onFilterChange({ ...filters, category_id: event.target.value })}
              className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm font-bold"
            >
              <option value="ALL">Todas as categorias</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-400">
              Pagamento
            </label>
            <Select
              value={filters.payment_method}
              onChange={(event) => onFilterChange({ ...filters, payment_method: event.target.value })}
              className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm font-bold"
            >
              <option value="ALL">Todos os pagamentos</option>
              <option value="PIX">PIX</option>
              <option value="CASH">Dinheiro</option>
              <option value="DEBIT_CARD">Débito</option>
              <option value="CREDIT_CARD">Crédito</option>
              <option value="COURTESY">Cortesia</option>
            </Select>
          </div>
          <div className="flex items-end">
            <div className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-500 xl:w-72">
              <Filter className="h-4 w-4 text-brand-red" />
              <span className="truncate">
                {activeCategory} · {activePayment}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto rounded-2xl bg-slate-100 p-1 hide-scrollbar">
          {(Object.keys(tabLabels) as ReportTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black uppercase transition-all ${
                activeTab === tab
                  ? "bg-white text-brand-charcoal shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

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
                {report.summary.paid_orders} pedidos pagos · {paidRate}% de conversão
              </p>
            </div>
            <span className="rounded-2xl bg-white/10 p-3 text-brand-yellow">
              <TrendingUp className="h-6 w-6" />
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
        title="Produto e pico"
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
  const top3Revenue = report.top_all_products
    .slice(0, 3)
    .reduce((total, product) => total + product.revenue, 0);
  const top3Share =
    report.summary.gross_sales > 0
      ? Math.round((top3Revenue / report.summary.gross_sales) * 100)
      : 0;

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <SignalCard
        icon={CheckCircle2}
        label="Saúde do caixa"
        value={pendingRate === 0 ? "Em dia" : `${pendingRate}% pendente`}
        detail={pendingRate === 0 ? "Sem valor pendente no recorte" : "Priorize baixa antes do fechamento"}
        tone={pendingRate === 0 ? "emerald" : "amber"}
      />
      <SignalCard
        icon={Target}
        label="Concentração top 3"
        value={`${top3Share}%`}
        detail={top3Share >= 70 ? "Receita muito dependente de poucos itens" : "Mix com distribuição saudável"}
        tone={top3Share >= 70 ? "amber" : "blue"}
      />
      <SignalCard
        icon={CreditCard}
        label="Meio líder"
        value={leadingPayment ? `${paymentShare}%` : "Sem dados"}
        detail={leadingPayment ? paymentLabel(leadingPayment.method) : "Aguardando pagamentos"}
        tone={paymentShare >= 75 ? "amber" : "zinc"}
      />
      <SignalCard
        icon={Percent}
        label="Desconto sobre bruto"
        value={`${discountRate}%`}
        detail={`${currency.format(report.summary.discounts)} concedidos`}
        tone={discountRate > 10 ? "red" : "zinc"}
      />
    </section>
  );
}

function FinancialCommand({ report }: { report: CashReportResponse }) {
  const netAfterAttention =
    report.summary.received -
    report.financial_attention.discount_total -
    report.financial_attention.courtesy_total;
  const riskTotal = report.summary.pending + report.summary.canceled;

  return (
    <Card className="border-slate-200">
      <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3 md:p-5">
        <CommandMetric
          label="Potencial líquido"
          value={currency.format(Math.max(netAfterAttention, 0))}
          detail="Recebido menos descontos e cortesias"
        />
        <CommandMetric
          label="Receita em risco"
          value={currency.format(riskTotal)}
          detail="Pendente + cancelado"
        />
        <CommandMetric
          label="Pedidos totais"
          value={String(report.summary.total_orders)}
          detail={`${report.summary.paid_orders} pagos no período`}
        />
      </CardContent>
    </Card>
  );
}

function HighlightCard({
  title,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  tone: "amber" | "blue";
}) {
  const toneClass = tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600";

  return (
    <Card className="border-slate-200">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p>
          <p className="mt-2 truncate text-xl font-black text-slate-900">{value}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">{sub}</p>
        </div>
        <span className={`rounded-xl p-3 ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function SignalCard({
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
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    red: "border-red-100 bg-red-50 text-red-700",
    zinc: "border-slate-100 bg-white text-slate-700",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-wide opacity-75">{label}</p>
        <Icon className="h-4 w-4 shrink-0" />
      </div>
      <p className="text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold opacity-80">{detail}</p>
    </div>
  );
}

function CommandMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "amber" | "blue" | "emerald" | "red" | "violet" | "zinc";
  icon: React.ElementType;
}) {
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
          <span className={`rounded-lg p-2 ${tones[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="text-2xl font-black text-slate-950">{value}</p>
        <p className="mt-1 text-xs font-medium text-slate-400">{sub}</p>
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
            <span className="mt-0.5 rounded-xl bg-white/70 p-2">
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

function PaymentPanel({ report }: { report: CashReportResponse }) {
  const items = report.payment_breakdown.filter((item) => item.count > 0);

  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-3 p-4">
        <PanelTitle icon={CreditCard} title="Uso dos meios de pagamento" />
        {items.length === 0 ? (
          <EmptyPanel text="Nenhum pagamento registrado no período." />
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
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
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

function CategoryPanel({
  categories,
  filtered,
}: {
  categories: CategoryStat[];
  filtered: boolean;
}) {
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((cat) => (
            <div key={cat.category_name} className="rounded-xl border border-slate-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">{cat.category_name}</p>
                  <p className="text-xs font-medium text-slate-400">{cat.quantity} unidades · {cat.orders_count} pedidos</p>
                </div>
                <CategoryIcon name={cat.category_name} />
              </div>
              <p className="mt-3 text-lg font-black text-slate-900">{currency.format(cat.revenue)}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-red" style={{ width: `${Math.min(cat.percent, 100)}%` }} />
              </div>
              <p className="mt-1 text-[10px] font-bold text-slate-400">{cat.percent.toFixed(1)}% do faturamento</p>
            </div>
          ))}
        </div>
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
  const maxQty = Math.max(...items.map((item) => item.quantity), 1);

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
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-white">
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

function HourlyPanel({ report }: { report: CashReportResponse }) {
  const maxOrders = Math.max(...report.hourly_sales.map((item) => item.orders), 1);

  return (
    <Card className="border-slate-200">
      <CardContent className="p-4">
        <PanelTitle icon={Clock} title="Controle por horário" />
        <div className="mt-6 flex h-56 items-end gap-2 border-b border-slate-100 px-1">
          {report.hourly_sales.map((hour) => {
            const height = hour.orders > 0 ? Math.max((hour.orders / maxOrders) * 100, 8) : 2;
            return (
              <div key={hour.range} className="flex h-full flex-1 flex-col justify-end gap-2">
                <div className="text-center text-[10px] font-black text-slate-500">
                  {hour.orders > 0 ? hour.orders : ""}
                </div>
                <div
                  className={`rounded-t-lg ${hour.orders === maxOrders && hour.orders > 0 ? "bg-brand-red" : "bg-slate-300"}`}
                  style={{ height: `${height}%` }}
                  title={`${hour.range}: ${hour.orders} pedidos`}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px] font-bold text-slate-400 md:grid-cols-8">
          {report.hourly_sales.map((hour) => (
            <span key={hour.range}>{hour.range}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WeekdayPanel({ report }: { report: CashReportResponse }) {
  const maxReceived = Math.max(...report.weekday_sales.map((item) => item.received), 1);

  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-3 p-4">
        <PanelTitle icon={BarChart3} title="Controle por dia da semana" />
        {report.weekday_sales.map((day) => (
          <div key={day.weekday} className="rounded-xl border border-slate-100 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-900">{day.weekday}</p>
                <p className="text-xs font-medium text-slate-400">{day.orders} pedidos · ticket {currency.format(day.average_ticket)}</p>
              </div>
              <p className="text-sm font-black text-slate-900">{currency.format(day.received)}</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-charcoal" style={{ width: `${(day.received / maxReceived) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LowSellingPanel({ report }: { report: CashReportResponse }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-3 p-4">
        <PanelTitle icon={AlertCircle} title="Produtos ativos sem saída" />
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
        <PanelTitle icon={FilterX} title="Auditoria financeira" />
        <AttentionRow icon={Percent} label="Descontos concedidos" value={currency.format(report.financial_attention.discount_total)} count={report.financial_attention.discount_orders} tone="red" />
        <AttentionRow icon={Gift} label="Pedidos em cortesia" value={currency.format(report.financial_attention.courtesy_total)} count={report.financial_attention.courtesy_orders} tone="violet" />
        <AttentionRow icon={XCircle} label="Cancelamentos" value={currency.format(report.financial_attention.canceled_total)} count={report.financial_attention.canceled_orders} tone="zinc" />
      </CardContent>
    </Card>
  );
}

function AttentionRow({
  icon: Icon,
  label,
  value,
  count,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  count: number;
  tone: "red" | "violet" | "zinc";
}) {
  const tones = {
    red: "bg-red-50 text-red-600",
    violet: "bg-violet-50 text-violet-600",
    zinc: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`rounded-xl p-2.5 ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
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
  if (lower.includes("doce")) Icon = Utensils;
  if (lower.includes("suco") || lower.includes("refrigerante")) Icon = Coffee;
  if (lower.includes("creme") || lower.includes("açaí") || lower.includes("acai")) Icon = Gift;
  if (lower.includes("batata")) Icon = Hash;

  return (
    <span className="rounded-xl bg-red-50 p-2 text-brand-red">
      <Icon className="h-4 w-4" />
    </span>
  );
}

function paymentIcon(method?: string) {
  switch (method) {
    case "PIX":
      return QrCode;
    case "CASH":
      return Banknote;
    case "DEBIT_CARD":
    case "CREDIT_CARD":
      return CreditCard;
    case "COURTESY":
      return Gift;
    default:
      return Zap;
  }
}

function paymentLabel(method?: string) {
  const labels: Record<string, string> = {
    ALL: "Todos os pagamentos",
    PIX: "PIX",
    CASH: "Dinheiro",
    DEBIT_CARD: "Débito",
    CREDIT_CARD: "Crédito",
    COURTESY: "Cortesia",
    PENDING: "Pendente",
  };
  return method ? labels[method] ?? method : "Sem dados";
}

function insightTone(severity: string) {
  if (severity === "positive") return "border-emerald-100 bg-emerald-50";
  if (severity === "warning" || severity === "negative") return "border-red-100 bg-red-50";
  return "border-blue-100 bg-blue-50";
}
