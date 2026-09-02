"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Filter,
  Gift,
  Hash,
  Lightbulb,
  ListOrdered,
  Loader2,
  Pencil,
  Pizza,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  ShoppingBag,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Utensils,
  XCircle,
  Zap,
  LayoutDashboard,
  Percent,
  Wallet,
  Download,
  Eye,
  EyeOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  CashReportFilters,
  CashReportResponse,
  HourlyStat,
  OrderTypeStat,
  OrderRecord,
  ProductStat,
  reportsApi,
} from "@/lib/api/reports-api";
import { ErrorState } from "@/components/feedback/ErrorState";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Card as BaseCard, CardContent } from "@/components/ui/Card";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useBranch } from "@/contexts/BranchContext";
import { SectionCompare } from "./compare";
import { MetricTile, ReportPanel, ReportSectionHeading } from "./report-primitives";
import {
  Period,
  PERIOD_LABELS,
  labelToDate,
  computeDates,
  computePrevDates,
  pctDelta,
  isClosedRange,
} from "@/lib/utils/report-periods";
import { buildReportCacheKey, readReportCache, writeReportCache } from "@/lib/utils/report-cache";

// ── Formatters ────────────────────────────────────────────────────────────────

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const longDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const reportDateKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const reportDateLabelFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
});
const reportWeekdayFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
});
const reportTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

// ── Types ─────────────────────────────────────────────────────────────────────

type Section = "overview" | "financial" | "sales" | "patterns" | "orders" | "compare";
type OrderFilter = "TODOS" | "PAGOS" | "PENDENTES" | "CANCELADOS" | "DESISTENCIAS";

interface AbcProduct extends ProductStat {
  cls: "A" | "B" | "C";
  cumPct: number;
}

interface DailyRow {
  date: string;
  label: string;
  received: number;
  orders: number;
  paid: number;
  avg: number;
}

// ── Navigation ────────────────────────────────────────────────────────────────

const SECTIONS: { id: Section; label: string; short: string; icon: React.ElementType }[] = [
  { id: "overview",  label: "Visão Geral",      short: "Geral",     icon: LayoutDashboard },
  { id: "financial", label: "Financeiro",        short: "Financeiro",icon: TrendingUp },
  { id: "sales",     label: "Vendas & Cardápio", short: "Vendas",    icon: ShoppingBag },
  { id: "patterns",  label: "Padrões",           short: "Padrões",   icon: CalendarDays },
  { id: "compare",   label: "Comparar",          short: "Comparar",  icon: TrendingDown },
  { id: "orders",    label: "Pedidos",           short: "Pedidos",   icon: ListOrdered },
];

const SECTION_DESCRIPTIONS: Record<Section, string> = {
  overview: "Indicadores essenciais do período.",
  financial: "Receita, margem e perdas.",
  sales: "Produtos, categorias e oportunidades.",
  patterns: "Demanda, tempo e capacidade.",
  compare: "Diferenças entre períodos.",
  orders: "Auditoria dos registros.",
};

// Todo painel do relatório passa pelo mesmo primitive: cor, borda, raio e
// elevação deixam de ser decisões de cada aba.
function Card({ className = "", ...props }: React.ComponentProps<typeof BaseCard>) {
  return <ReportPanel {...props} className={className} />;
}

// ── Computation helpers ───────────────────────────────────────────────────────

function getSaleDate(order: OrderRecord): Date {
  return new Date(order.paid_at ?? order.confirmed_at ?? order.created_at);
}

function getPeakHour(hourlySales: HourlyStat[]): HourlyStat | null {
  return hourlySales.reduce<HourlyStat | null>((best, hour) => {
    if (hour.orders <= 0) return best;
    if (!best || hour.orders > best.orders) return hour;
    return best;
  }, null);
}

function classifyABC(products: ProductStat[]): AbcProduct[] {
  const sorted = [...products].sort((a, b) => b.revenue - a.revenue);
  const total = sorted.reduce((s, p) => s + p.revenue, 0);
  let cumulative = 0;
  return sorted.map((p) => {
    cumulative += p.revenue;
    const cumPct = total > 0 ? (cumulative / total) * 100 : 100;
    const cls: "A" | "B" | "C" = cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C";
    return { ...p, cls, cumPct };
  });
}

function buildDailyRows(orders: OrderRecord[]): DailyRow[] {
  const map = new Map<string, DailyRow>();
  orders.forEach((o) => {
    const saleDate = getSaleDate(o);
    const day = reportDateKeyFmt.format(saleDate);
    if (!map.has(day)) {
      map.set(day, {
        date: day,
        label: `${reportDateLabelFmt.format(saleDate)} (${reportWeekdayFmt.format(saleDate)})`,
        received: 0, orders: 0, paid: 0, avg: 0,
      });
    }
    const row = map.get(day)!;
    row.orders++;
    if (o.payment_status === "PAID" && o.status !== "CANCELADO") {
      row.received += o.total_amount;
      row.paid++;
    }
  });
  const rows = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  rows.forEach((r) => { r.avg = r.paid > 0 ? r.received / r.paid : 0; });
  return rows;
}

// Desvio-padrão (z-score) de uma série pequena — usado pra marcar dias/horas
// "atípicos" dentro do próprio período selecionado (sem precisar buscar
// histórico fora do range já carregado). Com poucas amostras o z-score é
// ruidoso, então os painéis só o usam a partir de um mínimo de pontos.
function zScores(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);
  if (sd === 0) return values.map(() => 0);
  return values.map((v) => (v - mean) / sd);
}

// Exportação de planilha (CSV com BOM p/ Excel abrir acentuação corretamente).
// Usado por qualquer painel tabular do relatório — Pedidos, Receita dia a dia,
// Classificação ABC — pra não reimplementar blob/download em cada um.
function downloadCSV(filename: string, header: string[], rows: (string | number)[][]) {
  const csv = [header, ...rows]
    .map((r) => r.map((cell) => String(cell)).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Payment meta ──────────────────────────────────────────────────────────────

const PAYMENT_META: Record<string, { icon: React.ElementType; label: string; iconCls: string; barCls: string }> = {
  PIX:         { icon: QrCode,     label: "PIX",      iconCls: "bg-teal-500/10 text-teal-600",     barCls: "bg-teal-500" },
  CASH:        { icon: Banknote,   label: "Dinheiro",  iconCls: "bg-emerald-500/10 text-emerald-600", barCls: "bg-emerald-500" },
  DEBIT_CARD:  { icon: CreditCard, label: "Débito",   iconCls: "bg-blue-500/10 text-blue-600",     barCls: "bg-blue-500" },
  CREDIT_CARD: { icon: CreditCard, label: "Crédito",  iconCls: "bg-violet-500/10 text-violet-600", barCls: "bg-violet-500" },
  COURTESY:    { icon: Gift,       label: "Cortesia",  iconCls: "bg-pink-500/10 text-pink-600",     barCls: "bg-pink-400" },
  PENDING:     { icon: Clock,      label: "Pendente",  iconCls: "bg-amber-500/10 text-amber-600",   barCls: "bg-amber-400" },
  ALL:         { icon: Wallet,     label: "Todos",     iconCls: "bg-[var(--bg-subtle)] text-[var(--text-secondary)]", barCls: "bg-[var(--text-muted)]" },
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RelatorioPage() {
  const router = useRouter();
  const supabase = createClient();
  const { currentBranchId, currentBranch } = useBranch();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [report, setReport] = useState<CashReportResponse | null>(null);
  const [prevReport, setPrevReport] = useState<CashReportResponse | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<CashReportFilters>({
    payment_method: "ALL", category_id: "ALL", order_type: "ALL", weekday: "ALL", start_date: "", end_date: "",
  });
  const [period, setPeriod] = useState<Period>("today");
  const [customDate, setCustomDate] = useState<string>(""); // YYYY-MM-DD
  const [rangeStart, setRangeStart] = useState<string>(""); // YYYY-MM-DD
  const [rangeEnd, setRangeEnd] = useState<string>("");     // YYYY-MM-DD
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: profile } = await supabase
        .from("profiles").select("role, active").eq("id", user.id).single();
      if (!profile || profile.role !== "ADMIN" || !profile.active) {
        setIsAdmin(false);
        router.replace("/app/caixa");
      } else {
        setIsAdmin(true);
      }
    })();
  }, [router, supabase]);

  useEffect(() => {
    if (isAdmin === true) reportsApi.getCategories().then(setCategories);
  }, [isAdmin]);

  const loadReport = useCallback(async (opts?: { force?: boolean }) => {
    if (period === "custom" && !customDate) {
      setIsLoading(false);
      return;
    }
    if (period === "range" && (!rangeStart || !rangeEnd)) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const { start, end } = computeDates(period, customDate, rangeStart, rangeEnd);
      const { start: ps, end: pe } = computePrevDates(period, customDate, rangeStart, rangeEnd);
      const f = { ...filters, start_date: start.toISOString(), end_date: end.toISOString() };
      const pf = { ...filters, start_date: ps.toISOString(), end_date: pe.toISOString() };

      const bf = currentBranchId ? { ...f, branch_id: currentBranchId } : f;
      const bpf = currentBranchId ? { ...pf, branch_id: currentBranchId } : pf;

      // Períodos fechados (que não podem mais mudar) são cacheados na sessão
      // do navegador — evita reprocessar a mesma janela ao revisitar um dia
      // passado. "Atualizar" (force) sempre ignora e regrava o cache.
      const closed = isClosedRange({ start, end });
      const cacheKey = buildReportCacheKey({
        start: bf.start_date, end: bf.end_date, prevStart: bpf.start_date, prevEnd: bpf.end_date,
        categoryId: filters.category_id, paymentMethod: filters.payment_method, orderType: filters.order_type, weekday: filters.weekday, branchId: currentBranchId ?? null,
      });

      if (closed && !opts?.force) {
        const cached = readReportCache(cacheKey);
        if (cached) {
          setReport(cached.report);
          setPrevReport(cached.prevReport);
          setOrders(cached.orders);
          setIsLoading(false);
          return;
        }
      }

      const [cur, prev, ord] = await Promise.all([
        reportsApi.getCashReport(bf),
        reportsApi.getCashReport(bpf).catch(() => null),
        reportsApi.getOrdersForDateRange(start.toISOString(), end.toISOString(), currentBranchId, filters.order_type, filters.weekday),
      ]);
      setReport(cur);
      setPrevReport(prev);
      setOrders(ord);

      if (closed) writeReportCache(cacheKey, { report: cur, prevReport: prev, orders: ord });
    } catch (err: unknown) {
      setError(getFriendlyErrorMessage(err, "Não conseguimos carregar o relatório."));
    } finally {
      setIsLoading(false);
    }
  }, [period, customDate, rangeStart, rangeEnd, filters, currentBranchId]);

  useEffect(() => {
    if (isAdmin !== true) return;
    const timer = window.setTimeout(() => loadReport(), 0);
    return () => window.clearTimeout(timer);
  }, [isAdmin, loadReport]);

  // Range atual derivado para a aba Comparar.
  const currentRangeForCompare = useMemo(() => {
    if (period === "custom" && !customDate) return null;
    if (period === "range" && (!rangeStart || !rangeEnd)) return null;
    const { start, end } = computeDates(period, customDate, rangeStart, rangeEnd);
    const isSingleDay = period === "today" || period === "yesterday" || period === "custom";
    const label = period === "custom" && customDate
      ? customDate
      : period === "range" && rangeStart && rangeEnd
      ? `${rangeStart} → ${rangeEnd}`
      : PERIOD_LABELS[period];
    return { start, end, label, isSingleDay };
  }, [period, customDate, rangeStart, rangeEnd]);

  const dailyRows = useMemo(() => buildDailyRows(orders), [orders]);
  const abcProducts = useMemo(
    () => (report ? classifyABC(report.top_all_products) : []),
    [report],
  );
  const operationalScore = useMemo(
    () => (report ? computeScore(report) : null),
    [report],
  );
  const projection = useMemo(
    () => (report ? computeProjection(report, period, dailyRows) : null),
    [report, period, dailyRows],
  );

  if (isAdmin === null || (isAdmin === true && isLoading && !report)) {
    return <LoadingState message="Consolidando dados gerenciais..." />;
  }
  if (error) {
    return (
      <div className="p-6">
        <ErrorState title="Falha no relatório" message={error} onRetry={loadReport} />
      </div>
    );
  }

  const printPeriodLabel = currentRangeForCompare?.label ?? PERIOD_LABELS[period];

  return (
    <div className={`report-workspace ${showDetails ? "report-show-details" : "report-focus"} flex h-full flex-col bg-[var(--bg-base)] print:block print:h-auto`}>
      {/* ── Control panel ── */}
      <ControlPanel
        period={period}
        customDate={customDate}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        filters={filters}
        categories={categories}
        isLoading={isLoading}
        onPeriodChange={(p) => {
          setPeriod(p);
          if (p !== "custom") setCustomDate("");
          if (p !== "range") { setRangeStart(""); setRangeEnd(""); }
        }}
        onCustomDateChange={(d) => {
          setCustomDate(d);
          setPeriod("custom");
        }}
        onRangeChange={(start, end) => {
          setRangeStart(start);
          setRangeEnd(end);
          if (start && end) setPeriod("range");
          // "Limpar" no popover de intervalo: volta pro período padrão em vez de
          // deixar period="range" com datas vazias (relatório ficava travado/stale).
          else if (!start && !end && period === "range") setPeriod("today");
        }}
        onFilterChange={setFilters}
        onBack={() => router.push("/app/caixa")}
        onRefresh={() => loadReport({ force: true })}
        showDetails={showDetails}
        onToggleDetails={() => setShowDetails((current) => !current)}
      />

      {/* Recarregando com dado antigo ainda na tela (troca de período/filtro) —
          uma barra fina em vez de esconder o layout inteiro atrás de um spinner. */}
      {isLoading && report && <TopLoadingBar />}

      {/* ── Content ── */}
      <div className={`flex-1 overflow-y-auto print:overflow-visible ${isLoading && report ? "opacity-60 transition-opacity duration-200" : "transition-opacity duration-200"}`}>
        {isLoading && !report ? (
          <div className="p-8"><LoadingState message="Carregando dados..." /></div>
        ) : !report ? null : (
          <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 md:px-6 lg:px-8 print:max-w-none print:px-0 print:pb-4 print:pt-0">
            {/* Cabeçalho só visível ao imprimir/exportar PDF — a tela usa o ControlPanel (que fica oculto no print). */}
            <div className="hidden print:flex print:flex-col print:gap-0.5 print:border-b print:border-black/20 print:pb-3">
              <p className="text-lg font-black text-black">Marcos Krep&apos;s — Relatório de Caixa</p>
              <p className="text-xs font-medium text-black/70">
                {SECTIONS.find((s) => s.id === activeSection)?.label} · {printPeriodLabel} · impresso em {longDate.format(new Date())} {reportTimeFormatter.format(new Date())}
              </p>
            </div>
            <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start lg:gap-6">
              <SectionNav active={activeSection} onChange={setActiveSection} />
              <div className="min-w-0 space-y-6">
                <ReportContext
                  section={activeSection}
                  periodLabel={printPeriodLabel}
                  filters={filters}
                  branchName={currentBranch?.name ?? null}
                />
                {activeSection === "overview"  && <SectionOverview  report={report} prevReport={prevReport} score={operationalScore} projection={projection} monthlyGoal={currentBranch?.monthly_revenue_goal ?? null} />}
                {activeSection === "financial" && <SectionFinancial report={report} dailyRows={dailyRows} />}
                {activeSection === "sales"     && <SectionSales     report={report} abcProducts={abcProducts} />}
                {activeSection === "patterns"  && <SectionPatterns  report={report} />}
                {activeSection === "compare"   && currentRangeForCompare && (
                  <SectionCompare
                    currentRange={{ start: currentRangeForCompare.start, end: currentRangeForCompare.end, label: currentRangeForCompare.label }}
                    isSingleDay={currentRangeForCompare.isSingleDay}
                    branchId={currentBranchId ?? null}
                    orderType={filters.order_type ?? "ALL"}
                    weekday={filters.weekday ?? "ALL"}
                  />
                )}
                {activeSection === "orders"    && <SectionOrders    orders={orders} />}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Control panel ─────────────────────────────────────────────────────────────

function ControlPanel({
  period, customDate, rangeStart, rangeEnd, filters, categories, isLoading,
  onPeriodChange, onCustomDateChange, onRangeChange, onFilterChange, onBack, onRefresh, showDetails, onToggleDetails,
}: {
  period: Period;
  customDate: string;
  rangeStart: string;
  rangeEnd: string;
  filters: CashReportFilters;
  categories: { id: string; name: string }[];
  isLoading: boolean;
  onPeriodChange: (p: Period) => void;
  onCustomDateChange: (d: string) => void;
  onRangeChange: (start: string, end: string) => void;
  onFilterChange: (f: CashReportFilters) => void;
  onBack: () => void;
  onRefresh: () => void;
  showDetails: boolean;
  onToggleDetails: () => void;
}) {
  const todayKey = reportDateKeyFmt.format(new Date());
  const customLabel = customDate
    ? reportDateLabelFmt.format(labelToDate(customDate))
    : "Data";
  const rangeLabel = rangeStart && rangeEnd
    ? `${reportDateLabelFmt.format(labelToDate(rangeStart))} → ${reportDateLabelFmt.format(labelToDate(rangeEnd))}`
    : "Intervalo";
  // O rascunho só vira filtro ao tocar em "Aplicar". Assim o relatório não
  // recarrega como um único dia depois de escolher a primeira ponta do range.
  const [showRangeSheet, setShowRangeSheet] = useState(false);
  const [rangeDraft, setRangeDraft] = useState({ start: rangeStart, end: rangeEnd });

  const hasActiveFilters =
    (filters.category_id && filters.category_id !== "ALL") ||
    (filters.payment_method && filters.payment_method !== "ALL") ||
    (filters.order_type && filters.order_type !== "ALL") ||
    (filters.weekday && filters.weekday !== "ALL");
  const activeFilterCount = [filters.category_id, filters.payment_method, filters.order_type, filters.weekday]
    .filter((value) => value && value !== "ALL").length;

  const clearFilters = () =>
    onFilterChange({ ...filters, category_id: "ALL", payment_method: "ALL", order_type: "ALL", weekday: "ALL" });

  return (
    <div className="analytics-toolbar sticky top-14 z-20 border-b border-[var(--border)] print:hidden">
      {/* Row 1: navigation + refresh */}
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-6 lg:px-8">
        <button
          onClick={onBack}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] active:scale-95"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <div className="hidden shrink-0 md:block">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Gestão</p>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Relatório de caixa</p>
        </div>

        {/* Period pills */}
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto hide-scrollbar rounded-full bg-[var(--bg-subtle)] p-1">
          {(["today", "yesterday", "last7", "last30", "thisMonth"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                period === p
                  ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
          {/* Pill "Data" — abre date picker nativo */}
          <label
            className={`relative shrink-0 inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
              period === "custom"
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
            title="Escolher data específica"
          >
            <CalendarDays className="h-3 w-3" strokeWidth={1.75} />
            <span>{period === "custom" ? customLabel : "Data"}</span>
            <input
              type="date"
              max={todayKey}
              value={customDate}
              onChange={(e) => { if (e.target.value) onCustomDateChange(e.target.value); }}
              className="absolute inset-0 cursor-pointer opacity-0"
              tabIndex={-1}
            />
          </label>

          {/* Pill "Intervalo" — abre um BottomSheet (mesmo padrão mobile do resto do app) */}
          <button
            onClick={() => {
              setRangeDraft({ start: rangeStart, end: rangeEnd });
              setShowRangeSheet(true);
            }}
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
              period === "range"
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
            title="Escolher intervalo de datas"
          >
            <CalendarDays className="h-3 w-3" strokeWidth={1.75} />
            <span className="max-w-[180px] truncate">{period === "range" && rangeStart && rangeEnd ? rangeLabel : "Intervalo"}</span>
          </button>
        </div>

        <BottomSheet isOpen={showRangeSheet} onClose={() => setShowRangeSheet(false)} title="Escolher intervalo">
          <div className="space-y-4 p-6">
            <div className="rounded-xl bg-[var(--status-info-bg)] px-3 py-2.5 text-xs font-medium text-[var(--status-info)]">
              Selecione o primeiro e o último dia. O relatório incluirá todos os dias entre eles.
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Início do período</label>
                <input
                  type="date"
                  max={todayKey}
                  value={rangeDraft.start}
                  onChange={(e) => setRangeDraft((current) => ({
                    start: e.target.value,
                    end: current.end && e.target.value > current.end ? e.target.value : current.end,
                  }))}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] focus:border-brand-red focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Fim do período</label>
                <input
                  type="date"
                  max={todayKey}
                  min={rangeDraft.start || undefined}
                  value={rangeDraft.end}
                  onChange={(e) => setRangeDraft((current) => ({ ...current, end: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] focus:border-brand-red focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setRangeDraft({ start: "", end: "" }); onRangeChange("", ""); setShowRangeSheet(false); }}
                className="rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
              >
                Limpar
              </button>
              <button
                onClick={() => {
                  onRangeChange(rangeDraft.start, rangeDraft.end);
                  setShowRangeSheet(false);
                }}
                disabled={!rangeDraft.start || !rangeDraft.end}
                className="rounded-lg bg-brand-red px-4 py-2 text-xs font-black text-white disabled:opacity-40"
              >
                Aplicar
              </button>
            </div>
          </div>
        </BottomSheet>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 active:scale-95"
          title="Atualizar"
        >
          {isLoading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <RefreshCw className="h-4 w-4" strokeWidth={1.75} />}
        </button>

        <button
          onClick={() => window.print()}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] active:scale-95"
          title="Imprimir / salvar PDF da aba atual"
        >
          <Printer className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button
          onClick={onToggleDetails}
          className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors active:scale-95 ${
            showDetails
              ? "border-brand-red/25 bg-brand-red/5 text-brand-red"
              : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          }`}
          title={showDetails ? "Ocultar explicações" : "Mostrar explicações"}
          aria-pressed={showDetails}
        >
          {showDetails ? <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} /> : <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />}
          <span className="hidden lg:inline">{showDetails ? "Menos texto" : "Detalhes"}</span>
        </button>
      </div>

      {/* Row 2: secondary filters */}
      <div className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 pb-3 pt-2 hide-scrollbar md:px-6 lg:px-8">
        <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
          <Filter className="h-3 w-3" strokeWidth={1.75} /> Filtros
          {activeFilterCount > 0 && <span className="rounded-full bg-brand-red/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-red">{activeFilterCount}</span>}
        </span>

        {/* Category filter */}
        <FilterChip
          value={filters.category_id ?? "ALL"}
          onChange={(v) => onFilterChange({ ...filters, category_id: v })}
        >
          <option value="ALL">Todas as categorias</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </FilterChip>

        {/* Payment filter */}
        <FilterChip
          value={filters.payment_method ?? "ALL"}
          onChange={(v) => onFilterChange({ ...filters, payment_method: v })}
        >
          <option value="ALL">Todos os pagamentos</option>
          <option value="PIX">PIX</option>
          <option value="CASH">Dinheiro</option>
          <option value="DEBIT_CARD">Débito</option>
          <option value="CREDIT_CARD">Crédito</option>
        </FilterChip>

        <FilterChip
          value={filters.order_type ?? "ALL"}
          onChange={(v) => onFilterChange({ ...filters, order_type: v as CashReportFilters["order_type"] })}
        >
          <option value="ALL">Todos os tipos</option>
          <option value="BALCAO">Balcão</option>
          <option value="VIAGEM">Retirada</option>
          <option value="ENTREGA">Entrega</option>
        </FilterChip>

        <FilterChip
          value={filters.weekday ?? "ALL"}
          onChange={(v) => onFilterChange({ ...filters, weekday: v as CashReportFilters["weekday"] })}
        >
          <option value="ALL">Todos os dias</option>
          <option value="Segunda">Segundas</option>
          <option value="Terça">Terças</option>
          <option value="Quarta">Quartas</option>
          <option value="Quinta">Quintas</option>
          <option value="Sexta">Sextas</option>
          <option value="Sábado">Sábados</option>
          <option value="Domingo">Domingos</option>
        </FilterChip>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[var(--status-danger-bg)] px-2.5 py-1.5 text-xs font-semibold text-[var(--status-danger)] hover:opacity-90"
          >
            <XCircle className="h-3 w-3" strokeWidth={1.75} />
            Limpar
          </button>
        )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  value, onChange, children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  const isActive = value !== "ALL";
  return (
    <div className={`relative shrink-0 inline-flex items-center gap-1 rounded-full border px-1 py-0 transition-colors ${
      isActive
        ? "border-brand-red/25 bg-brand-red/5"
        : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)]"
    }`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-7 cursor-pointer appearance-none bg-transparent pl-2.5 pr-6 text-[11px] font-black focus:outline-none ${
          isActive ? "text-brand-red" : "text-[var(--text-secondary)]"
        }`}
      >
        {children}
      </select>
      <ChevronDown className={`pointer-events-none absolute right-2 h-3 w-3 shrink-0 ${isActive ? "text-brand-red/70" : "text-[var(--text-muted)]"}`} />
    </div>
  );
}

// ── Section nav ───────────────────────────────────────────────────────────────

function SectionNav({ active, onChange }: { active: Section; onChange: (s: Section) => void }) {
  return (
    <nav aria-label="Seções do relatório" className="mb-5 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-2 print:hidden lg:sticky lg:top-4 lg:mb-0 lg:overflow-visible lg:p-3">
      <p className="hidden px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] lg:block">Explorar relatório</p>
      <div className="flex gap-1 hide-scrollbar lg:flex-col">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onChange(s.id)}
              className={`relative inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold md:px-4 lg:w-full lg:justify-start lg:px-3 ${
                isActive
                  ? "bg-[var(--bg-inverse)] text-white shadow-[var(--elevation-1)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={isActive ? 2 : 1.75} />
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{s.short}</span>
              {isActive && <span className="h-1.5 w-1.5 rounded-full bg-brand-red lg:ml-auto" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// Barra fina e indeterminada no topo do conteúdo — indicador de "recarregando"
// que não esconde o relatório atrás de um spinner de página inteira.
function TopLoadingBar() {
  return (
    <div className="relative h-0.5 w-full overflow-hidden bg-brand-red/15 print:hidden">
      <div className="absolute inset-y-0 w-1/3 animate-[top-loading-bar_1.1s_ease-in-out_infinite] rounded-full bg-brand-red" />
      <style>{`
        @keyframes top-loading-bar {
          0%   { left: -33%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}

function ReportContext({
  section: sectionId, periodLabel, filters, branchName,
}: {
  section: Section;
  periodLabel: string;
  filters: CashReportFilters;
  branchName: string | null;
}) {
  const section = SECTIONS.find((item) => item.id === sectionId)!;
  const Icon = section.icon;
  const filterLabels = [
    filters.order_type && filters.order_type !== "ALL"
      ? ({ BALCAO: "Balcão", VIAGEM: "Retirada", ENTREGA: "Entrega" }[filters.order_type])
      : null,
    filters.payment_method && filters.payment_method !== "ALL"
      ? PAYMENT_META[filters.payment_method]?.label ?? filters.payment_method
      : null,
    filters.weekday && filters.weekday !== "ALL" ? filters.weekday : null,
  ].filter((label): label is string => Boolean(label));

  return (
    <section className="analytics-context rounded-2xl p-4 md:flex md:items-center md:justify-between md:gap-6 md:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{section.label}</p>
          <h2 className="mt-0.5 text-subtitle font-semibold text-[var(--text-primary)]">{SECTION_DESCRIPTIONS[section.id]}</h2>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 md:mt-0 md:max-w-[45%] md:justify-end">
        {branchName && <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">{branchName}</span>}
        <span className="rounded-full bg-[var(--bg-inverse)] px-2.5 py-1 text-[11px] font-semibold text-white">{periodLabel}</span>
        {filterLabels.map((label) => <span key={label} className="rounded-full border border-brand-red/15 bg-brand-red/5 px-2.5 py-1 text-[11px] font-semibold text-brand-red">{label}</span>)}
      </div>
    </section>
  );
}

// ── Alertas de desvio ─────────────────────────────────────────────────────────
// Diferente dos "insights" (que narram o período), alertas de desvio comparam
// contra o período anterior e só disparam quando o desvio é grande o
// suficiente pra merecer atenção — pensado pra ser lido em 3 segundos no
// início do relatório, não misturado com curiosidades operacionais.

interface DeviationAlert {
  key: string;
  label: string;
  message: string;
  severity: "critical" | "warning";
}

function pushDeviationAlert(
  alerts: DeviationAlert[],
  key: string,
  label: string,
  curr: number,
  prev: number,
  opts: { minPrev: number; badDirection: "up" | "down"; threshold: number; unit: "currency" | "int" },
) {
  const delta = pctDelta(curr, prev);
  if (delta === null || prev < opts.minPrev) return;
  const isBad = opts.badDirection === "up" ? delta > 0 : delta < 0;
  if (!isBad || Math.abs(delta) < opts.threshold) return;
  const fmt = (v: number) => (opts.unit === "currency" ? currency.format(v) : String(Math.round(v)));
  const verb = delta > 0 ? "subiu" : "caiu";
  alerts.push({
    key,
    label,
    message: `${label} ${verb} ${Math.abs(delta).toFixed(0)}% vs. o período anterior (${fmt(prev)} → ${fmt(curr)}).`,
    severity: Math.abs(delta) >= opts.threshold * 1.5 ? "critical" : "warning",
  });
}

function computeDeviationAlerts(report: CashReportResponse, prevReport: CashReportResponse | null): DeviationAlert[] {
  if (!prevReport) return [];
  const alerts: DeviationAlert[] = [];
  pushDeviationAlert(alerts, "received", "Recebido", report.summary.received, prevReport.summary.received,
    { minPrev: 50, badDirection: "down", threshold: 20, unit: "currency" });
  pushDeviationAlert(alerts, "paid_orders", "Pedidos pagos", report.summary.paid_orders, prevReport.summary.paid_orders,
    { minPrev: 5, badDirection: "down", threshold: 20, unit: "int" });
  pushDeviationAlert(alerts, "average_ticket", "Ticket médio", report.summary.average_ticket, prevReport.summary.average_ticket,
    { minPrev: 5, badDirection: "down", threshold: 15, unit: "currency" });
  pushDeviationAlert(alerts, "canceled", "Cancelamentos", report.summary.canceled, prevReport.summary.canceled,
    { minPrev: 20, badDirection: "up", threshold: 50, unit: "currency" });
  pushDeviationAlert(alerts, "courtesy", "Cortesias", report.summary.courtesy, prevReport.summary.courtesy,
    { minPrev: 20, badDirection: "up", threshold: 50, unit: "currency" });

  const rank: Record<DeviationAlert["severity"], number> = { critical: 0, warning: 1 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 4);
}

// ── Score operacional ─────────────────────────────────────────────────────────

interface OperationalScore {
  total: number; // 0–100
  conversionRate: number;   // % pedidos pagos
  cancellationRate: number; // % cancelamentos (invertido)
  consistency: number;      // 0–100 (baseado em coef. de variação dos dias)
  discountImpact: number;   // % descontos+cortesias sobre bruto (invertido)
}

function computeScore(report: CashReportResponse): OperationalScore {
  const { summary } = report;
  const conversionRate = summary.total_orders > 0
    ? (summary.paid_orders / summary.total_orders) * 100
    : 100;
  const cancelRate = summary.total_orders > 0
    ? (report.financial_attention.canceled_orders / summary.total_orders) * 100
    : 0;
  const discountPct = summary.gross_sales > 0
    ? ((summary.discounts + summary.courtesy) / summary.gross_sales) * 100
    : 0;

  // Hourly consistency: inverse of coefficient of variation
  const receivedValues = report.hourly_sales.filter((h) => h.orders > 0).map((h) => h.received);
  let consistency = 100;
  if (receivedValues.length > 1) {
    const mean = receivedValues.reduce((a, b) => a + b, 0) / receivedValues.length;
    const variance = receivedValues.reduce((a, b) => a + (b - mean) ** 2, 0) / receivedValues.length;
    const cv = mean > 0 ? (Math.sqrt(variance) / mean) * 100 : 0;
    consistency = Math.max(0, Math.min(100, 100 - cv));
  }

  const score =
    Math.min(conversionRate, 100) * 0.35 +
    Math.max(0, 100 - cancelRate * 5) * 0.25 +
    consistency * 0.20 +
    Math.max(0, 100 - discountPct * 3) * 0.20;

  return {
    total: Math.round(Math.min(100, Math.max(0, score))),
    conversionRate,
    cancellationRate: cancelRate,
    consistency,
    discountImpact: discountPct,
  };
}

// ── Projeção de receita ───────────────────────────────────────────────────────

interface RevenueProjection {
  avgPerDay: number;
  daysWorked: number;
  daysInPeriod: number;
  projectedTotal: number;
  optimistic: number;
  pessimistic: number;
  isMonthly: boolean;
  daysRemainingInMonth: number;
  projectedMonthEnd: number;
}

function computeProjection(
  report: CashReportResponse,
  period: Period,
  dailyRows: DailyRow[],
): RevenueProjection | null {
  if (dailyRows.length === 0) return null;
  const daysWorked = dailyRows.filter((r) => r.orders > 0).length || 1;
  const avgPerDay = report.summary.received / daysWorked;

  const receivedByDay = dailyRows.filter((r) => r.orders > 0).map((r) => r.received);
  const stdDev = receivedByDay.length > 1
    ? Math.sqrt(receivedByDay.reduce((s, v) => s + (v - avgPerDay) ** 2, 0) / receivedByDay.length)
    : avgPerDay * 0.15;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysRemainingInMonth = daysInMonth - dayOfMonth;

  const daysInPeriod = period === "today" ? 1
    : period === "yesterday" ? 1
    : period === "last7" ? 7
    : period === "last30" ? 30
    : daysInMonth;

  return {
    avgPerDay,
    daysWorked,
    daysInPeriod,
    projectedTotal: avgPerDay * daysInPeriod,
    optimistic: (avgPerDay + stdDev) * daysInPeriod,
    pessimistic: Math.max(0, (avgPerDay - stdDev) * daysInPeriod),
    isMonthly: period === "thisMonth",
    daysRemainingInMonth,
    projectedMonthEnd: report.summary.received + avgPerDay * daysRemainingInMonth,
  };
}

// ── Ritmo da meta mensal ──────────────────────────────────────────────────────
// Só aparece quando a filial tem `monthly_revenue_goal` configurada
// (Configurações → Filiais) e o período selecionado é "Este mês". Reaproveita
// a mesma projeção de fechamento do mês já usada no ProjectionPanel.

interface GoalPace {
  goal: number;
  received: number;
  progressPct: number;
  projectedMonthEnd: number;
  onTrack: boolean;
  gap: number;
  daysRemaining: number;
}

function computeGoalPace(received: number, goal: number, projection: RevenueProjection): GoalPace {
  const projectedMonthEnd = projection.projectedMonthEnd;
  return {
    goal,
    received,
    progressPct: goal > 0 ? (received / goal) * 100 : 0,
    projectedMonthEnd,
    onTrack: projectedMonthEnd >= goal,
    gap: goal - projectedMonthEnd,
    daysRemaining: projection.daysRemainingInMonth,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1 — VISÃO GERAL
// ════════════════════════════════════════════════════════════════════════════

function SectionOverview({
  report, prevReport, score, projection, monthlyGoal,
}: {
  report: CashReportResponse;
  prevReport: CashReportResponse | null;
  score: OperationalScore | null;
  projection: RevenueProjection | null;
  monthlyGoal: number | null;
}) {
  const topPayment = report.payment_breakdown
    .filter((i) => i.count > 0 && i.method !== "PENDING")
    .sort((a, b) => b.total - a.total)[0];

  const bestWeekday = [...report.weekday_sales].sort((a, b) => b.received - a.received)[0];
  const peakHour = getPeakHour(report.hourly_sales);
  const deviationAlerts = computeDeviationAlerts(report, prevReport);
  const goalPace = projection?.isMonthly && monthlyGoal
    ? computeGoalPace(report.summary.received, monthlyGoal, projection)
    : null;

  return (
    <div className="space-y-6">
      <ExecutiveHero report={report} prevReport={prevReport} score={score} />
      {/* Alertas de desvio */}
      {deviationAlerts.length > 0 && <DeviationAlertsPanel alerts={deviationAlerts} />}

      {/* Ritmo da meta mensal */}
      {goalPace && <GoalPacePanel pace={goalPace} />}

      {/* Métricas de decisão */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <ScorecardCard
            label="Pedidos"
            value={String(report.summary.total_orders)}
            prev={prevReport ? String(prevReport.summary.total_orders) : null}
            delta={prevReport ? pctDelta(report.summary.total_orders, prevReport.summary.total_orders) : null}
            icon={ShoppingBag}
            tone="blue"
          />
          <ScorecardCard
            label="Ticket médio"
            value={currency.format(report.summary.average_ticket)}
            prev={prevReport ? currency.format(prevReport.summary.average_ticket) : null}
            delta={prevReport ? pctDelta(report.summary.average_ticket, prevReport.summary.average_ticket) : null}
            icon={CreditCard}
            tone="violet"
          />
          <ScorecardCard
            label="Cancelamentos"
            value={currency.format(report.summary.canceled)}
            prev={prevReport ? currency.format(prevReport.summary.canceled) : null}
            delta={prevReport ? pctDelta(report.summary.canceled, prevReport.summary.canceled) : null}
            icon={XCircle}
            tone="red"
            invertDelta
          />
      </div>

      <OrderTypeBreakdownPanel entries={report.order_type_breakdown} />
      <PeriodAveragePanel report={report} />

      {/* Sinais rápidos */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {report.top_all_products[0] && (
            <HighlightTile
              icon={Trophy}
              label="Produto estrela"
              primary={report.top_all_products[0].name}
              secondary={`${report.top_all_products[0].quantity} un · ${currency.format(report.top_all_products[0].revenue)}`}
              tone="amber"
            />
          )}
          {topPayment && (
            <HighlightTile
              icon={PAYMENT_META[topPayment.method]?.icon ?? Wallet}
              label="Pagamento líder"
              primary={PAYMENT_META[topPayment.method]?.label ?? topPayment.method}
              secondary={`${topPayment.percent.toFixed(1)}% das vendas`}
              tone="teal"
            />
          )}
          {bestWeekday?.weekday && (
            <HighlightTile
              icon={CalendarDays}
              label="Melhor dia"
              primary={bestWeekday.weekday}
              secondary={`${bestWeekday.orders} pedidos · ${currency.format(bestWeekday.received)}`}
              tone="emerald"
            />
          )}
          {peakHour?.range && (
            <HighlightTile
              icon={Zap}
              label="Hora de pico"
              primary={peakHour.range}
              secondary={`${peakHour.orders} pedidos · ${currency.format(peakHour.received)}`}
              tone="violet"
            />
          )}
      </div>

      {/* Score + Projection */}
      {(score || projection) && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {score && <ScorePanel score={score} />}
          {projection && <ProjectionPanel projection={projection} />}
        </div>
      )}

      {/* Insights */}
      {report.insights.length > 0 && (
        <div>
          <SectionLabel>Insights gerados</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {report.insights.map((ins, i) => {
              const style =
                ins.severity === "positive" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" :
                ins.severity === "warning"  ? "border-amber-500/30 bg-amber-500/10 text-amber-600" :
                ins.severity === "negative" ? "border-red-500/30 bg-red-500/10 text-red-600" :
                                              "border-blue-500/30 bg-blue-500/10 text-blue-600";
              const Icon =
                ins.severity === "positive" ? CheckCircle2 :
                ins.severity === "warning"  ? AlertCircle :
                ins.severity === "negative" ? XCircle :
                                              Lightbulb;
              return (
                <div key={i} className={`flex gap-3 rounded-2xl border p-4 ${style}`}>
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wide">{ins.title}</p>
                    <p className="analytics-detail mt-0.5 text-sm font-medium leading-snug opacity-90">{ins.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ExecutiveHero({
  report, prevReport, score,
}: {
  report: CashReportResponse;
  prevReport: CashReportResponse | null;
  score: OperationalScore | null;
}) {
  const receivedDelta = prevReport ? pctDelta(report.summary.received, prevReport.summary.received) : null;
  const conversion = report.summary.total_orders > 0
    ? (report.summary.paid_orders / report.summary.total_orders) * 100
    : 0;
  return (
    <section className="relative overflow-hidden rounded-3xl bg-[var(--bg-inverse)] px-5 py-6 text-white shadow-[var(--elevation-2)] md:px-7 md:py-7">
      <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-brand-red/25 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))] lg:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">Receita recebida</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums md:text-5xl">{currency.format(report.summary.received)}</p>
          {receivedDelta != null && (
            <span className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${receivedDelta >= 0 ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-200"}`}>
              {receivedDelta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {Math.abs(receivedDelta).toFixed(1)}% vs. período anterior
            </span>
          )}
        </div>
        <HeroMetric label="Margem" value={`${report.summary.gross_margin_percent.toFixed(1)}%`} emphasis={report.summary.gross_margin_percent >= 30} />
        <HeroMetric label="Conversão" value={`${conversion.toFixed(0)}%`} emphasis={conversion >= 80} />
        <HeroMetric label="Operação" value={score ? `${score.total}/100` : "—"} emphasis={Boolean(score && score.total >= 70)} />
      </div>
    </section>
  );
}

function HeroMetric({ label, value, emphasis }: { label: string; value: string; emphasis: boolean }) {
  return (
    <div className="border-l border-white/10 pl-4 lg:pl-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${emphasis ? "text-white" : "text-amber-200"}`}>{value}</p>
    </div>
  );
}

function DeviationAlertsPanel({ alerts }: { alerts: DeviationAlert[] }) {
  return (
    <div className="space-y-2">
      {alerts.map((a) => {
        const style = a.severity === "critical"
          ? "border-red-500/30 bg-red-500/10 text-red-700"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700";
        return (
          <div key={a.key} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${style}`}>
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
            <p className="text-sm font-bold leading-snug">{a.message}</p>
          </div>
        );
      })}
    </div>
  );
}

function ScorePanel({ score }: { score: OperationalScore }) {
  const color =
    score.total >= 80 ? { ring: "text-emerald-600", bg: "bg-emerald-500", label: "Excelente", txt: "text-emerald-600", badge: "bg-emerald-500/10 text-emerald-600" }
    : score.total >= 60 ? { ring: "text-amber-500",  bg: "bg-amber-400",   label: "Regular",   txt: "text-amber-600",  badge: "bg-amber-500/10 text-amber-600" }
    : { ring: "text-red-600",   bg: "bg-red-500",     label: "Atenção",   txt: "text-red-600",   badge: "bg-red-500/10 text-red-600" };

  const circ = 2 * Math.PI * 36;
  const dash = (score.total / 100) * circ;

  const components = [
    { label: "Conversão (pagos/total)", pct: score.conversionRate, good: score.conversionRate >= 80 },
    { label: "Cancelamentos",           pct: 100 - Math.min(100, score.cancellationRate * 5), good: score.cancellationRate < 10 },
    { label: "Consistência operacional",pct: score.consistency, good: score.consistency >= 60 },
    { label: "Impacto de descontos",    pct: Math.max(0, 100 - score.discountImpact * 3), good: score.discountImpact < 10 },
  ];

  return (
    <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <PanelHeader icon={BarChart3} title="Score operacional" />
        <div className="mt-5 flex items-center gap-6">
          {/* Ring */}
          <div className="relative shrink-0">
            <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
              <circle cx="48" cy="48" r="36" fill="none" stroke="var(--bg-subtle)" strokeWidth="8" />
              <circle
                cx="48" cy="48" r="36" fill="none"
                stroke="currentColor" strokeWidth="8"
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                className={color.ring}
                style={{ transition: "stroke-dasharray 0.8s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className={`text-2xl font-black ${color.txt}`}>{score.total}</p>
              <p className="text-[9px] font-bold uppercase text-[var(--text-muted)]">/ 100</p>
            </div>
          </div>
          {/* Details */}
          <div className="min-w-0 flex-1 space-y-2.5">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-black ${color.badge}`}>{color.label}</span>
            {components.map((c) => (
              <div key={c.label}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] font-medium text-[var(--text-secondary)]">{c.label}</p>
                  <p className={`shrink-0 text-[11px] font-black ${c.good ? "text-emerald-600" : "text-red-600"}`}>
                    {c.pct.toFixed(0)}%
                  </p>
                </div>
                <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  <div
                    className={`h-full rounded-full ${c.good ? "bg-emerald-500" : "bg-red-400"}`}
                    style={{ width: `${Math.min(100, c.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GoalPacePanel({ pace }: { pace: GoalPace }) {
  const tone = pace.onTrack
    ? { text: "text-emerald-600", bar: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-600", label: "No ritmo" }
    : { text: "text-red-600", bar: "bg-red-500", badge: "bg-red-500/10 text-red-600", label: "Atrás do ritmo" };
  return (
    <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <PanelHeader icon={Target} title="Meta mensal" />
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-black ${tone.badge}`}>{tone.label}</span>
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-2">
          <p className="text-2xl font-black text-[var(--text-primary)]">{currency.format(pace.received)}</p>
          <p className="text-xs font-bold text-[var(--text-muted)]">meta {currency.format(pace.goal)}</p>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, pace.progressPct)}%` }} />
        </div>
        <p className="mt-1 text-[11px] font-bold text-[var(--text-muted)]">{pace.progressPct.toFixed(0)}% da meta recebido até agora</p>

        <MetricTile
          className="mt-4"
          label="Projeção de fechamento"
          value={currency.format(pace.projectedMonthEnd)}
          icon={TrendingUp}
          tone={pace.onTrack ? "success" : "danger"}
          meta={pace.onTrack
            ? `${currency.format(pace.projectedMonthEnd - pace.goal)} acima da meta se o ritmo continuar`
            : `Faltam ${currency.format(pace.gap)} para a meta · ${pace.daysRemaining} dia${pace.daysRemaining !== 1 ? "s" : ""} restantes`}
        />
      </CardContent>
    </Card>
  );
}

function ProjectionPanel({ projection: p }: { projection: RevenueProjection }) {
  return (
    <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <PanelHeader icon={TrendingUp} title="Projeção de receita" />
        <div className="mt-5 space-y-4">
          <MetricTile label="Média diária" value={currency.format(p.avgPerDay)} icon={CalendarDays} tone="neutral" meta={`${p.daysWorked} dia${p.daysWorked !== 1 ? "s" : ""} com vendas`} />

          <div className="grid grid-cols-3 gap-2">
            <MetricTile label="Pessimista" value={currency.format(p.pessimistic)} tone="danger" />
            <MetricTile label="Projetado" value={currency.format(p.projectedTotal)} tone="success" />
            <MetricTile label="Otimista" value={currency.format(p.optimistic)} tone="info" />
          </div>

          {p.isMonthly && p.daysRemainingInMonth > 0 && (
            <MetricTile label="Fechamento do mês" value={currency.format(p.projectedMonthEnd)} icon={CalendarDays} tone="info" meta={`Base: ${p.daysWorked} dias · faltam ${p.daysRemainingInMonth} dias`} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ScorecardCard({
  label, value, prev, delta, icon: Icon, tone, invertDelta,
}: {
  label: string; value: string; prev: string | null; delta: number | null;
  icon: React.ElementType; tone: "emerald" | "blue" | "violet" | "red" | "amber";
  invertDelta?: boolean;
}) {
  const isPositive = delta == null ? null : (invertDelta ? delta <= 0 : delta >= 0);
  const normalizedTrend = delta == null ? null : isPositive ? Math.abs(delta) : -Math.abs(delta);
  const metricTone = tone === "emerald" ? "success" : tone === "blue" ? "info" : tone === "red" ? "danger" : tone === "amber" ? "warning" : "brand";
  return <MetricTile label={label} value={value} icon={Icon} tone={metricTone} trend={normalizedTrend} meta={prev ? `vs. período anterior: ${prev}` : "Sem histórico comparável"} />;
}

function HighlightTile({
  icon: Icon, label, primary, secondary, tone,
}: {
  icon: React.ElementType; label: string; primary: string; secondary: string;
  tone: "amber" | "teal" | "emerald" | "violet";
}) {
  const metricTone = tone === "emerald" ? "success" : tone === "amber" ? "warning" : tone === "teal" ? "info" : "brand";
  return <MetricTile label={label} value={primary} icon={Icon} tone={metricTone} meta={secondary} />;
}

const ORDER_TYPE_META: Record<OrderTypeStat["type"], { label: string; detail: string; tone: string }> = {
  BALCAO: { label: "Balcão", detail: "consumo presencial", tone: "border-blue-500/25 bg-blue-500/5" },
  VIAGEM: { label: "Retirada", detail: "pedido para viagem", tone: "border-violet-500/25 bg-violet-500/5" },
  ENTREGA: { label: "Entrega", detail: "delivery próprio", tone: "border-amber-500/30 bg-amber-500/10" },
};

function OrderTypeBreakdownPanel({ entries }: { entries: OrderTypeStat[] }) {
  if (!entries?.length) return null;
  const byType = new Map(entries.map((entry) => [entry.type, entry]));
  return (
    <div>
      <SectionLabel>Resultado por tipo de pedido</SectionLabel>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {(["BALCAO", "VIAGEM", "ENTREGA"] as const).map((type) => {
          const item = byType.get(type);
          const meta = ORDER_TYPE_META[type];
          return (
            <Card key={type} className={`border ${meta.tone}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-[var(--text-primary)]">{meta.label}</p>
                    <p className="analytics-detail text-[10px] font-medium text-[var(--text-muted)]">{meta.detail}</p>
                  </div>
                  <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-black text-[var(--text-secondary)]">{item?.orders ?? 0} pedidos</span>
                </div>
                <p className="mt-4 text-xl font-black tabular-nums text-[var(--text-primary)]">{currency.format(item?.received ?? 0)}</p>
                <p className="analytics-detail mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">recebido · ticket {currency.format(item?.average_ticket ?? 0)}</p>
                {type === "ENTREGA" && (
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-amber-500/20 pt-3 text-[11px]">
                    <div><p className="text-[var(--text-muted)]">Taxa / motoboy</p><p className="font-black tabular-nums text-amber-700">{currency.format(item?.courier_reserve ?? 0)}</p></div>
                    <div><p className="text-[var(--text-muted)]">Fica na loja</p><p className="font-black tabular-nums text-emerald-700">{currency.format(item?.store_received ?? 0)}</p></div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function PeriodAveragePanel({ report }: { report: CashReportResponse }) {
  const occurrences = report.metadata.occurrence_count ?? 0;
  if (occurrences <= 1) return null;
  const weekday = report.metadata.selected_weekday && report.metadata.selected_weekday !== "ALL"
    ? `por ${report.metadata.selected_weekday.toLowerCase()}`
    : "por dia comercial";
  return (
    <Card className="border-[var(--border)] bg-[var(--bg-subtle)]">
      <CardContent className="p-4">
        <div className="mb-3"><p className="text-xs font-black text-[var(--text-primary)]">Médias do período</p><p className="analytics-detail text-[11px] text-[var(--text-muted)]">{occurrences} ocorrências · dias sem venda contam como zero</p></div>
        <div className="grid gap-2 sm:grid-cols-3">
          <AverageMetric label={`Recebido ${weekday}`} value={currency.format(report.summary.received / occurrences)} icon={Banknote} tone="success" />
          <AverageMetric label={`Pedidos ${weekday}`} value={(report.summary.total_orders / occurrences).toFixed(1)} icon={ListOrdered} tone="info" />
          <AverageMetric label={`Margem ${weekday}`} value={currency.format(report.summary.gross_margin / occurrences)} icon={TrendingUp} tone="brand" />
        </div>
      </CardContent>
    </Card>
  );
}

function AverageMetric({ label, value, icon, tone }: { label: string; value: string; icon: React.ElementType; tone: "success" | "info" | "brand" }) {
  return <MetricTile label={label} value={value} icon={icon} tone={tone} />;
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 — FINANCEIRO
// ════════════════════════════════════════════════════════════════════════════

function SectionFinancial({
  report, dailyRows,
}: {
  report: CashReportResponse;
  dailyRows: DailyRow[];
}) {
  return (
    <div className="space-y-5">
      <ReportSectionHeading eyebrow="Financeiro" title="O que entra, o que custa e o que sobra" />
      <MarginPanel report={report} />
      <DeliveryFinancePanel report={report} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <WaterfallPanel report={report} />
        <PaymentPanel report={report} />
      </div>
      {dailyRows.length > 1 && <DailyTablePanel rows={dailyRows} />}
      <AuditPanel report={report} />
    </div>
  );
}

// Margem bruta: receita líquida (recebido) − COGS (custo congelado dos itens vendidos).
// Considera apenas pedidos PAID (não cancelados). Se cost_price for 0 nos produtos,
// a margem aparenta 100% — é o esperado até cadastro de custo.
function MarginPanel({ report }: { report: CashReportResponse }) {
  const { received, cogs, gross_margin, gross_margin_percent } = report.summary;
  if (received <= 0) return null;

  const hasCost = cogs > 0;
  return (
    <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <PanelHeader icon={Percent} title="Margem bruta" />
        {!hasCost && (
          <p className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-700">
            Cadastre o custo dos produtos em Cardápio → Editar produto para enxergar a margem real.
            Sem custo, a margem aparece como 100% do recebido.
          </p>
        )}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricTile label="Recebido" value={currency.format(received)} icon={Banknote} tone="neutral" />
          <MetricTile label="Custo dos produtos" value={`-${currency.format(cogs)}`} icon={TrendingDown} tone="danger" meta="Somente pedidos pagos" />
          <MetricTile label="Margem bruta" value={currency.format(gross_margin)} icon={TrendingUp} tone={gross_margin >= 0 ? "success" : "danger"} meta={`${gross_margin_percent.toFixed(1)}% de margem`} />
        </div>
      </CardContent>
    </Card>
  );
}

function DeliveryFinancePanel({ report }: { report: CashReportResponse }) {
  const delivery = report.order_type_breakdown.find((entry) => entry.type === "ENTREGA");
  if (!delivery || delivery.orders === 0) return null;
  return (
    <Card className="border-amber-500/30 bg-amber-500/[0.03] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <PanelHeader icon={Wallet} title="Financeiro do delivery" />
            <p className="analytics-detail mt-1 text-xs font-medium text-[var(--text-muted)]">A taxa de entrega é dinheiro de passagem: 100% fica reservado ao motoboy.</p>
          </div>
          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-black text-amber-700">{delivery.orders} pedidos</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <DeliveryValue label="Produtos" value={delivery.product_sales} tone="neutral" />
          <DeliveryValue label="Embalagem" value={delivery.packing_fees} tone="neutral" />
          <DeliveryValue label="Taxa cobrada" value={delivery.delivery_fees} tone="warning" />
          <DeliveryValue label="Reserva motoboy" value={-delivery.courier_reserve} tone="danger" />
          <DeliveryValue label="Fica na loja" value={delivery.store_received} tone="success" />
        </div>
      </CardContent>
    </Card>
  );
}

function DeliveryValue({ label, value, tone }: { label: string; value: number; tone: "neutral" | "success" | "warning" | "danger" }) {
  return <MetricTile label={label} value={currency.format(value)} tone={tone} />;
}

// Decomposição honesta do faturamento.
//
// Regra do back-end (cash-report/index.ts):
//   gross_sales = recebido + pendente  (CORTESIA NÃO ENTRA — é custo)
//   discounts   = Σ discount_amount dos não-cancelados (informativo; já refletido em gross_sales)
//   courtesy    = Σ total_amount dos cortesia (custo / receita não realizada)
//   canceled    = Σ total_amount dos cancelados (fora de gross_sales)
//
// Cortesia é custo (cliente não pagou) — sai do faturamento e aparece como dedução.
// Logo: received + pending ≈ gross_sales.
function WaterfallPanel({ report }: { report: CashReportResponse }) {
  const { summary } = report;
  const max = summary.gross_sales || 1;
  const pct = (v: number) => Math.max((v / max) * 100, v > 0 ? 2 : 0);

  const destinations: { label: string; value: number; barCls: string; textCls: string }[] = [
    { label: "Recebido (pago)", value: summary.received,  barCls: "bg-emerald-500",     textCls: "text-emerald-700" },
    { label: "Pendente",        value: summary.pending,   barCls: "bg-amber-400",       textCls: "text-amber-700"   },
  ];

  return (
    <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <PanelHeader icon={TrendingUp} title="Composição da receita" />

        {/* Faturamento total (não-cancelados) — barra cheia que será dividida abaixo */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-[var(--text-primary)]">Faturamento</p>
            <p className="text-sm font-black text-[var(--text-primary)]">
              {currency.format(summary.gross_sales)}
            </p>
          </div>
          <p className="analytics-detail mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
            Pedidos não-cancelados (descontos já aplicados)
          </p>
          {/* Barra empilhada: received | pending | courtesy proporcionais a gross_sales */}
          <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
            {destinations.map((d) =>
              d.value > 0 ? (
                <div
                  key={d.label}
                  className={`h-full ${d.barCls}`}
                  style={{ width: `${(d.value / max) * 100}%` }}
                />
              ) : null,
            )}
          </div>
        </div>

        {/* Destinos */}
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            Para onde foi
          </p>
          {destinations.map((d) => (
            <div key={d.label} className="flex items-center gap-3">
              <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${d.barCls}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-[var(--text-secondary)]">{d.label}</p>
                  <p className={`text-sm font-black ${d.textCls}`}>
                    {currency.format(d.value)}
                    {summary.gross_sales > 0 && (
                      <span className="ml-1.5 text-[11px] font-bold text-[var(--text-muted)]">
                        ({Math.round((d.value / summary.gross_sales) * 100)}%)
                      </span>
                    )}
                  </p>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  <div className={`h-full rounded-full ${d.barCls}`} style={{ width: `${pct(d.value)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Visões paralelas — descontos/cancelamentos são informativos; cortesia é custo */}
        {(summary.discounts > 0 || summary.canceled > 0 || summary.courtesy > 0) && (
          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
              À parte
            </p>
            <div className="mt-2 space-y-1.5">
              {summary.courtesy > 0 && (
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-bold text-pink-700">
                    Cortesias (custo)
                    <span className="ml-1.5 text-[10px] font-medium text-[var(--text-muted)]">
                      (cliente não pagou — fora do faturamento)
                    </span>
                  </p>
                  <p className="text-xs font-black text-pink-700">
                    -{currency.format(summary.courtesy)}
                  </p>
                </div>
              )}
              {summary.discounts > 0 && (
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-bold text-[var(--text-secondary)]">
                    Descontos concedidos
                    <span className="ml-1.5 text-[10px] font-medium text-[var(--text-muted)]">
                      (já refletido no faturamento)
                    </span>
                  </p>
                  <p className="text-xs font-black text-[var(--text-secondary)]">
                    {currency.format(summary.discounts)}
                  </p>
                </div>
              )}
              {summary.canceled > 0 && (
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-bold text-[var(--text-secondary)]">
                    Cancelados
                    <span className="ml-1.5 text-[10px] font-medium text-[var(--text-muted)]">
                      (fora do faturamento)
                    </span>
                  </p>
                  <p className="text-xs font-black text-[var(--text-secondary)]">
                    {currency.format(summary.canceled)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentPanel({ report }: { report: CashReportResponse }) {
  const active = report.payment_breakdown.filter((i) => i.count > 0);
  const max = Math.max(...active.map((i) => i.total), 1);
  return (
    <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <PanelHeader icon={Wallet} title="Meios de pagamento" />
        <div className="mt-5 space-y-3">
          {active.length === 0 ? <EmptyPanel text="Nenhum pagamento no período." /> : active.map((item) => {
            const meta = PAYMENT_META[item.method] ?? PAYMENT_META.ALL;
            const Icon = meta.icon;
            return (
              <div key={item.method}>
                <div className="flex items-center gap-3">
                  <span className={`shrink-0 rounded-xl p-2 ${meta.iconCls}`}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-bold text-[var(--text-primary)]">{meta.label}</p>
                      <p className="shrink-0 text-sm font-black text-[var(--text-primary)]">{currency.format(item.total)}</p>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                        <div className={`h-full rounded-full ${meta.barCls}`} style={{ width: `${(item.total / max) * 100}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-[11px] font-bold text-[var(--text-muted)]">{item.percent.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <p className="mt-0.5 pl-11 text-[11px] font-medium text-[var(--text-muted)]">{item.count} pedido{item.count !== 1 ? "s" : ""}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Um dia é "atípico" quando seu recebido foge do padrão dos outros dias do
// mesmo período selecionado (z-score, não histórico externo). Com menos de 4
// dias no período o desvio-padrão é ruído — não marca nada.
const ANOMALY_Z_THRESHOLD = 1.5;

function DailyTablePanel({ rows }: { rows: DailyRow[] }) {
  const maxReceived = Math.max(...rows.map((r) => r.received), 1);
  const zs = rows.length >= 4 ? zScores(rows.map((r) => r.received)) : rows.map(() => 0);
  const exportCSV = () => downloadCSV(
    `receita-dia-a-dia-${new Date().toISOString().substring(0, 10)}.csv`,
    ["Data", "Pedidos", "Ticket médio", "Recebido"],
    rows.map((r) => [r.label, r.orders, r.avg.toFixed(2).replace(".", ","), r.received.toFixed(2).replace(".", ",")]),
  );
  return (
    <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <PanelHeader icon={CalendarDays} title="Receita dia a dia" action={<ExportCsvButton onClick={exportCSV} />} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="pb-2 text-left text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">Data</th>
                <th className="pb-2 text-right text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">Pedidos</th>
                <th className="pb-2 text-right text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">Ticket</th>
                <th className="pb-2 text-right text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">Recebido</th>
                <th className="pb-2 pl-4 text-left text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">Distribuição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r, i) => {
                const pct = (r.received / maxReceived) * 100;
                const isBest = r.received === maxReceived;
                const z = zs[i];
                const isAnomaly = Math.abs(z) >= ANOMALY_Z_THRESHOLD;
                return (
                  <tr key={r.date} className={isBest ? "bg-emerald-500/10" : ""}>
                    <td className="py-2.5 text-left font-bold text-[var(--text-primary)]">
                      <span className="inline-flex items-center gap-1.5">
                        {r.label}
                        {isAnomaly && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-600"
                            title={`Recebido ${z > 0 ? "muito acima" : "muito abaixo"} do padrão dos outros dias deste período`}
                          >
                            <AlertCircle className="h-2.5 w-2.5" strokeWidth={2.5} />
                            atípico
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-medium text-[var(--text-secondary)]">{r.orders}</td>
                    <td className="py-2.5 text-right font-medium text-[var(--text-secondary)]">{currency.format(r.avg)}</td>
                    <td className={`py-2.5 text-right font-black ${isBest ? "text-emerald-600" : "text-[var(--text-primary)]"}`}>
                      {currency.format(r.received)}
                    </td>
                    <td className="py-2.5 pl-4">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                        <div
                          className={`h-full rounded-full ${isBest ? "bg-emerald-500" : "bg-brand-red/40"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function AuditPanel({ report }: { report: CashReportResponse }) {
  const fa = report.financial_attention;
  return (
    <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <PanelHeader icon={Filter} title="Auditoria financeira" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AuditTile
            icon={Percent}
            label="Descontos concedidos"
            total={fa.discount_total}
            count={fa.discount_orders}
            tone="red"
          />
          <AuditTile
            icon={Gift}
            label="Pedidos em cortesia"
            total={fa.courtesy_total}
            count={fa.courtesy_orders}
            tone="violet"
          />
          <AuditTile
            icon={XCircle}
            label="Cancelamentos"
            total={fa.canceled_total}
            count={fa.canceled_orders}
            tone="zinc"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AuditTile({ icon: Icon, label, total, count, tone }: {
  icon: React.ElementType; label: string; total: number; count: number;
  tone: "red" | "violet" | "zinc";
}) {
  const metricTone = tone === "red" ? "danger" : tone === "violet" ? "brand" : "neutral";
  return <MetricTile label={label} value={currency.format(total)} icon={Icon} tone={metricTone} meta={`${count} registro${count !== 1 ? "s" : ""}`} />;
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 — VENDAS & CARDÁPIO
// ════════════════════════════════════════════════════════════════════════════

function SectionSales({
  report, abcProducts,
}: {
  report: CashReportResponse;
  abcProducts: AbcProduct[];
}) {
  return (
    <div className="space-y-5">
      <ReportSectionHeading eyebrow="Vendas" title="Mix, giro e oportunidades do cardápio" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CategoryMixPanel report={report} />
        <AbcPanel products={abcProducts} />
      </div>
      <CategoryRankingsPanel report={report} />
      <LowSellersPanel report={report} />
    </div>
  );
}

function CategoryMixPanel({ report }: { report: CashReportResponse }) {
  const cats = [...report.category_breakdown].sort((a, b) => b.revenue - a.revenue);
  const CATEGORY_COLORS = [
    "bg-brand-red", "bg-blue-500", "bg-teal-500", "bg-violet-500",
    "bg-amber-500", "bg-emerald-500", "bg-pink-500",
  ];
  return (
    <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <PanelHeader icon={BarChart3} title="Mix de categorias" />
        {cats.length === 0 ? <EmptyPanel text="Sem dados de categoria." /> : (
          <>
            {/* Stacked bar */}
            <div className="mt-5 flex h-3 w-full overflow-hidden rounded-full">
              {cats.map((cat, i) => (
                <div
                  key={cat.category_name}
                  className={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                  style={{ width: `${cat.percent}%` }}
                  title={`${cat.category_name}: ${cat.percent.toFixed(1)}%`}
                />
              ))}
            </div>
            {/* Legend */}
            <div className="mt-4 space-y-2.5">
              {cats.map((cat, i) => (
                <div key={cat.category_name} className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-bold text-[var(--text-primary)]">{cat.category_name}</p>
                      <p className="shrink-0 text-sm font-black text-[var(--text-primary)]">{currency.format(cat.revenue)}</p>
                    </div>
                    <p className="text-[11px] font-medium text-[var(--text-muted)]">
                      {cat.quantity} un · {cat.orders_count} pedidos · {cat.percent.toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AbcPanel({ products }: { products: AbcProduct[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? products : products.slice(0, 10);
  const ABC_STYLE = {
    A: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    B: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    C: "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border)]",
  };
  const exportCSV = () => downloadCSV(
    `classificacao-abc-${new Date().toISOString().substring(0, 10)}.csv`,
    ["Produto", "Categoria", "Classe", "Qtd", "Receita", "% acumulado"],
    products.map((p) => [p.name, p.category, p.cls, p.quantity, p.revenue.toFixed(2).replace(".", ","), p.cumPct.toFixed(1).replace(".", ",")]),
  );
  return (
    <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <PanelHeader icon={Trophy} title="Classificação ABC" action={<ExportCsvButton onClick={exportCSV} />} />
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-bold text-emerald-600">A = 80% da receita</span>
          <span className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 font-bold text-blue-600">B = próximos 15%</span>
          <span className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-2 py-1 font-bold text-[var(--text-secondary)]">C = últimos 5%</span>
        </div>
        {products.length === 0 ? <EmptyPanel text="Sem produtos para classificar." /> : (
          <>
            <div className="mt-4 space-y-1.5">
              {shown.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/60 px-3 py-2">
                  <span className="w-5 shrink-0 text-right text-xs font-black text-[var(--text-muted)]">{i + 1}</span>
                  <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-black ${ABC_STYLE[p.cls]}`}>{p.cls}</span>
                  <p className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--text-primary)]">{p.name}</p>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-[var(--text-primary)]">{currency.format(p.revenue)}</p>
                    <p className="text-[10px] font-medium text-[var(--text-muted)]">{p.cumPct.toFixed(0)}% acum.</p>
                  </div>
                </div>
              ))}
            </div>
            {products.length > 10 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                {expanded ? "Mostrar menos" : `Ver mais ${products.length - 10} produtos`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryRankingsPanel({ report }: { report: CashReportResponse }) {
  const groups: { title: string; items: ProductStat[]; icon: React.ElementType }[] = [
    { title: "Kreps Salgados", items: report.category_rankings.savory_kreps, icon: Pizza },
    { title: "Kreps Doces",    items: report.category_rankings.sweet_kreps,  icon: Utensils },
    { title: "Sucos",          items: report.category_rankings.juices,        icon: Zap },
    { title: "Refrigerantes",  items: report.category_rankings.sodas,         icon: Hash },
    { title: "Batata",         items: report.category_rankings.potatoes,      icon: Hash },
    { title: "Cremes / Açaí",  items: report.category_rankings.creams,        icon: Hash },
    { title: "Outros",         items: report.category_rankings.others,        icon: Hash },
  ].filter((g) => g.items.length > 0);

  return (
    <div>
      <SectionLabel>Ranking por categoria</SectionLabel>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <CategoryRankCard key={group.title} title={group.title} items={group.items} icon={group.icon} />
        ))}
      </div>
    </div>
  );
}

function CategoryRankCard({ title, items, icon: Icon }: { title: string; items: ProductStat[]; icon: React.ElementType }) {
  const max = Math.max(...items.map((i) => i.quantity), 1);
  return (
    <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-xl bg-brand-red/10 p-2 text-brand-red"><Icon className="h-4 w-4" /></span>
          <h3 className="text-sm font-black text-[var(--text-primary)]">{title}</h3>
        </div>
        <div className="space-y-2.5">
          {items.slice(0, 5).map((item, i) => (
            <div key={item.name} className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--bg-subtle)] text-[10px] font-black text-[var(--text-secondary)]">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-1">
                  <p className="truncate text-xs font-bold text-[var(--text-primary)]">{item.name}</p>
                  <p className="shrink-0 text-xs font-black text-[var(--text-primary)]">{item.quantity} un.</p>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  <div className="h-full rounded-full bg-brand-red" style={{ width: `${(item.quantity / max) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LowSellersPanel({ report }: { report: CashReportResponse }) {
  if (report.low_selling_products.length === 0) return null;
  return (
    <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <PanelHeader icon={AlertCircle} title="Produtos sem saída no período" />
        <p className="analytics-detail mt-1 text-xs font-medium text-[var(--text-muted)]">
          Esses produtos estão ativos no cardápio mas não tiveram vendas. Considere removê-los ou reposicioná-los.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {report.low_selling_products.map((item) => (
            <Link
              key={item.product_id}
              href={`/app/cardapio?product_id=${item.product_id}`}
              className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2.5 transition-colors hover:border-brand-red/40 hover:bg-brand-red/5"
              title="Editar produto no cardápio"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--text-primary)]">{item.name}</p>
                <p className="text-[11px] font-medium text-[var(--text-muted)]">{item.category}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-black text-[var(--text-muted)] group-hover:bg-brand-red group-hover:text-white">
                <Pencil className="h-2.5 w-2.5" strokeWidth={2.5} />
                Editar
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 4 — PADRÕES OPERACIONAIS
// ════════════════════════════════════════════════════════════════════════════

function SectionPatterns({ report }: { report: CashReportResponse }) {
  return (
    <div className="space-y-5">
      <ReportSectionHeading eyebrow="Operação" title="Quando vender e onde a operação perde ritmo" />
      <DeliveryOperationPanel report={report} />
      <PipelinePanel report={report} />
      <HeatmapPanel report={report} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <HourlyPanel report={report} />
        <WeekdayPanel report={report} />
      </div>
      <CancellationPanel report={report} />
    </div>
  );
}

function DeliveryOperationPanel({ report }: { report: CashReportResponse }) {
  const op = report.delivery_operation;
  if (!op || op.total_orders === 0) return null;
  return (
    <Card className="border-amber-500/30 shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <PanelHeader icon={Clock} title="Operação de entrega" />
        <p className="analytics-detail mt-1 text-xs font-medium text-[var(--text-muted)]">Tempos do motoboy são medidos após o pedido estar pronto, separados da cozinha.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <OperationValue label="Entregas" value={String(op.total_orders)} />
          <OperationValue label="A despachar" value={String(op.awaiting_dispatch)} warn={op.awaiting_dispatch > 0} />
          <OperationValue label="Em rota" value={String(op.on_route)} warn={op.on_route > 0} />
          <OperationValue label="Concluídas" value={String(op.delivered)} />
          <OperationValue label="Pronto → despacho" value={op.ready_to_dispatch.count ? `${op.ready_to_dispatch.median} min` : "—"} />
          <OperationValue label="Despacho → entrega" value={op.dispatch_to_delivered.count ? `${op.dispatch_to_delivered.median} min` : "—"} />
        </div>
      </CardContent>
    </Card>
  );
}

function OperationValue({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return <MetricTile label={label} value={value} tone={warn ? "warning" : "neutral"} />;
}

/**
 * Heatmap dia × hora — 7 linhas × 24 colunas. Intensidade da cor reflete
 * o valor da métrica selecionada (pedidos ou receita) relativo ao máximo.
 * Decide escala de pessoal, horário de funcionamento, dias-foco para promoção.
 */
function HeatmapPanel({ report }: { report: CashReportResponse }) {
  const [metric, setMetric] = useState<"orders" | "received">("orders");
  if (!report.heatmap || report.heatmap.length === 0) return null;

  const max = report.heatmap.reduce((m, c) => Math.max(m, c[metric]), 0);
  if (max === 0) {
    return (
      <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
        <CardContent className="p-5">
          <PanelHeader icon={CalendarDays} title="Heatmap dia × hora" />
          <EmptyPanel text="Sem movimento no período." />
        </CardContent>
      </Card>
    );
  }

  // Linha por dia da semana — usa ordem semântica (Dom → Sáb)
  const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const cellByKey = new Map(report.heatmap.map((c) => [`${c.weekday}|${c.hour}`, c]));

  // Top 3 células para destacar o hotspot
  const top3 = [...report.heatmap].sort((a, b) => b[metric] - a[metric]).slice(0, 3).map((c) => `${c.weekday}|${c.hour}`);
  const topKeys = new Set(top3);

  function intensity(v: number) {
    if (v === 0) return 0;
    const ratio = v / max;
    // Curva sublinear: mesmo células médias ficam visíveis
    return Math.max(0.08, Math.pow(ratio, 0.6));
  }

  return (
    <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <PanelHeader icon={CalendarDays} title="Heatmap dia × hora" />
          <div className="flex items-center gap-1 rounded-full bg-[var(--bg-subtle)] p-1 text-[11px] font-semibold">
            <button
              onClick={() => setMetric("orders")}
              className={`rounded-full px-2.5 py-1 ${metric === "orders" ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]" : "text-[var(--text-secondary)]"}`}
            >
              Pedidos
            </button>
            <button
              onClick={() => setMetric("received")}
              className={`rounded-full px-2.5 py-1 ${metric === "received" ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]" : "text-[var(--text-secondary)]"}`}
            >
              Receita
            </button>
          </div>
        </div>
        <p className="analytics-detail mt-1 text-xs font-medium text-[var(--text-muted)]">
          Cada célula é {metric === "orders" ? "pedidos" : "receita recebida"} no dia × hora. Top 3 hotspots destacados.
        </p>
        <div className="mt-4 overflow-x-auto hide-scrollbar">
          <div className="min-w-[720px]">
            {/* Header de horas */}
            <div className="grid grid-cols-[64px_repeat(24,minmax(0,1fr))] gap-px text-[9px] font-bold text-[var(--text-muted)]">
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="px-0.5 text-center">{String(h).padStart(2, "0")}</div>
              ))}
            </div>
            {/* Linhas por dia */}
            <div className="mt-1 space-y-px">
              {WEEKDAYS.map((wd) => (
                <div key={wd} className="grid grid-cols-[64px_repeat(24,minmax(0,1fr))] gap-px">
                  <div className="pr-2 text-right text-[10px] font-bold text-[var(--text-secondary)] leading-[20px]">{wd.slice(0, 3)}</div>
                  {Array.from({ length: 24 }, (_, h) => {
                    const key = `${wd}|${h}`;
                    const cell = cellByKey.get(key);
                    const v = cell?.[metric] ?? 0;
                    const i = intensity(v);
                    const isTop = topKeys.has(key) && v > 0;
                    const title = cell
                      ? `${wd} ${String(h).padStart(2, "0")}h: ${cell.orders} pedido${cell.orders !== 1 ? "s" : ""} · ${currency.format(cell.received)}`
                      : `${wd} ${String(h).padStart(2, "0")}h: sem dados`;
                    return (
                      <div
                        key={h}
                        title={title}
                        className={`h-5 rounded-sm ${isTop ? "ring-1 ring-brand-red" : ""}`}
                        style={{
                          backgroundColor: v === 0
                            ? "var(--bg-subtle)"
                            : `rgba(220, 38, 38, ${i})`, // brand-red com alpha
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            {/* Escala */}
            <div className="mt-3 flex items-center justify-end gap-2 text-[10px] font-bold text-[var(--text-muted)]">
              <span>Menor</span>
              <div className="flex h-2 w-32 overflow-hidden rounded-full">
                {[0.08, 0.25, 0.5, 0.75, 1].map((a) => (
                  <div key={a} className="flex-1" style={{ backgroundColor: `rgba(220, 38, 38, ${a})` }} />
                ))}
              </div>
              <span>Maior</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Painel "Gargalo por etapa".
 *
 * Decompõe o ciclo do pedido em 3 etapas e mostra mediana, p90, máximo e
 * "tempo perdido em fila" (Σ minutos acima da mediana — estimativa do que
 * poderia ter sido vendido se a operação rodasse na sua própria mediana).
 */
function PipelinePanel({ report }: { report: CashReportResponse }) {
  const p = report.pipeline_stages;
  if (!p) return null;
  const stages: { key: keyof typeof p; label: string; hint: string }[] = [
    { key: "acceptance", label: "Criação → Aceite",    hint: "Tempo até confirmar o pedido" },
    { key: "delivery",   label: "Aceite → Entrega",    hint: "Cozinha + saída do balcão"     },
    { key: "payment",    label: "Criação → Pagamento", hint: "Fechamento financeiro"          },
  ];

  // Pior gargalo = etapa com maior p90 (latência da maioria dos pedidos lentos).
  const worst = stages.reduce<{ key: string; p90: number } | null>((best, s) => {
    const v = p[s.key].p90;
    if (!best || v > best.p90) return { key: s.key, p90: v };
    return best;
  }, null);

  const hasAnyData = stages.some((s) => p[s.key].count > 0);
  if (!hasAnyData) return null;

  return (
    <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <PanelHeader icon={Clock} title="Gargalo por etapa" />
          {worst && p[worst.key as keyof typeof p].count > 0 && (
            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-700">
              Pior latência: {stages.find((s) => s.key === worst.key)?.label.split(" → ")[1]}
            </span>
          )}
        </div>
        <p className="analytics-detail mt-1 text-xs font-medium text-[var(--text-muted)]">
          Quanto tempo cada etapa do pedido leva — mediana = caso típico, p90 = quase pior caso, fila = capacidade perdida.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {stages.map((s) => {
            const stat = p[s.key];
            const isWorst = worst?.key === s.key && stat.count > 0;
            return (
              <div
                key={s.key}
                className={`analytics-tile p-4 ${
                  isWorst
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "border-[var(--border)] bg-[var(--bg-surface)]"
                }`}
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{s.label}</p>
                <p className="analytics-detail mt-0.5 text-[10px] font-medium text-[var(--text-muted)]">{s.hint}</p>
                {stat.count === 0 ? (
                  <p className="mt-3 text-xs font-medium text-[var(--text-muted)]">Sem dados no período</p>
                ) : (
                  <>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <PipelineMetric label="Mediana" value={`${stat.median}min`} highlight />
                      <PipelineMetric label="p90" value={`${stat.p90}min`} />
                      <PipelineMetric label="Máx" value={`${stat.max}min`} />
                    </div>
                    <div className="mt-3 rounded-xl bg-[var(--bg-subtle)] px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                        Tempo perdido em fila
                      </p>
                      <p className="mt-0.5 text-sm font-black text-[var(--text-primary)] tabular-nums">
                        {formatMinutes(stat.queue_loss_min)}
                      </p>
                      <p className="mt-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                        {stat.count} pedido{stat.count !== 1 ? "s" : ""} avaliados
                      </p>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function PipelineMetric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 ${highlight ? "bg-brand-red/10" : "bg-[var(--bg-subtle)]"}`}>
      <p className={`text-[9px] font-bold uppercase tracking-wide ${highlight ? "text-brand-red" : "text-[var(--text-muted)]"}`}>{label}</p>
      <p className={`mt-0.5 text-xs font-black tabular-nums ${highlight ? "text-brand-red" : "text-[var(--text-primary)]"}`}>{value}</p>
    </div>
  );
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

function HourlyPanel({ report }: { report: CashReportResponse }) {
  const maxOrders = Math.max(...report.hourly_sales.map((i) => i.orders), 1);
  const peakHour = getPeakHour(report.hourly_sales);
  const revenuePeakHour = report.hourly_sales.reduce<HourlyStat | null>((best, hour) => {
    if (hour.received <= 0) return best;
    if (!best || hour.received > best.received) return hour;
    return best;
  }, null);

  // Anomalia por horário: z-score do volume de pedidos entre as horas com
  // movimento (ignora as zeradas, que só poluiriam a média). Limiar mais alto
  // que o dos dias — 24 buckets geram mais ruído que uma série de dias.
  const activeHours = report.hourly_sales.filter((h) => h.orders > 0);
  const activeZs = activeHours.length >= 5 ? zScores(activeHours.map((h) => h.orders)) : [];
  const anomalyRanges = new Set(
    activeHours.filter((_, i) => Math.abs(activeZs[i] ?? 0) >= 1.75).map((h) => h.range),
  );

  return (
    <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <PanelHeader icon={Zap} title="Volume por horário" />
          {peakHour && (
            <span className="rounded-full bg-brand-red/10 px-2 py-1 text-[10px] font-black text-brand-red">
              Pico: {peakHour.range}
            </span>
          )}
        </div>
        <div className="overflow-x-auto hide-scrollbar">
          <div className="mt-6 flex h-44 min-w-[720px] items-end gap-1 border-b border-[var(--border)] px-0.5">
            {report.hourly_sales.map((hour) => {
              const h = hour.orders > 0 ? Math.max((hour.orders / maxOrders) * 100, 6) : 2;
              const isPeak = peakHour?.range === hour.range;
              const isAnomaly = anomalyRanges.has(hour.range);
              return (
                <div key={hour.range} className="flex h-full flex-1 flex-col justify-end gap-1">
                  {hour.orders > 0 && (
                    <span className="flex items-center justify-center gap-0.5 text-center text-[9px] font-black text-[var(--text-muted)]">
                      {isAnomaly && <AlertCircle className="h-2 w-2 text-amber-500" strokeWidth={3} />}
                      {hour.orders}
                    </span>
                  )}
                  <div
                    className={`rounded-t-md transition-all ${
                      isPeak ? "bg-brand-red" : isAnomaly ? "bg-amber-400/70 ring-1 ring-inset ring-amber-500" : "bg-[var(--bg-subtle)] hover:bg-[var(--border-strong)]"
                    }`}
                    style={{ height: `${h}%` }}
                    title={`${hour.range}: ${hour.orders} pedidos · ${currency.format(hour.received)}${isAnomaly ? " — fora do padrão do período" : ""}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex min-w-[720px]">
            {report.hourly_sales.map((hour) => (
              <div key={hour.range} className="flex-1 whitespace-nowrap text-center text-[9px] font-medium text-[var(--text-muted)]">
                {hour.range.split("h")[0]}h
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "Total pedidos", value: String(report.hourly_sales.reduce((s, h) => s + h.orders, 0)), icon: ListOrdered, tone: "neutral" as const },
            { label: "Hora de pico", value: peakHour?.range ?? "—", icon: Clock, tone: "warning" as const },
            { label: "Maior receita", value: revenuePeakHour ? currency.format(revenuePeakHour.received) : "—", icon: Banknote, tone: "success" as const },
          ].map((s) => (
            <MetricTile key={s.label} label={s.label} value={s.value} icon={s.icon} tone={s.tone} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WeekdayPanel({ report }: { report: CashReportResponse }) {
  const maxReceived = Math.max(...report.weekday_sales.map((i) => i.received), 1);
  const sorted = [...report.weekday_sales].sort((a, b) => b.received - a.received);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  return (
    <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <PanelHeader icon={CalendarDays} title="Padrão semanal" />
          {best?.weekday && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-600">
              Melhor: {best.weekday}
            </span>
          )}
        </div>
        <div className="mt-5 space-y-2">
          {report.weekday_sales.map((day) => {
            const pct = (day.received / maxReceived) * 100;
            const isBest = day.weekday === best?.weekday;
            const isWorst = day.weekday === worst?.weekday && day.received < best?.received;
            return (
              <div key={day.weekday} data-tone={isBest ? "success" : undefined} className={`analytics-tile p-3 ${isBest ? "text-emerald-700" : ""}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={`text-sm font-black ${isBest ? "text-emerald-600" : "text-[var(--text-primary)]"}`}>{day.weekday}</p>
                    <p className="text-[11px] font-medium text-[var(--text-muted)]">
                      {day.orders} pedidos · ticket {currency.format(day.average_ticket)}
                    </p>
                  </div>
                  <p className={`text-sm font-black ${isBest ? "text-emerald-600" : "text-[var(--text-primary)]"}`}>
                    {currency.format(day.received)}
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  <div
                    className={`h-full rounded-full ${isBest ? "bg-emerald-500" : isWorst ? "bg-[var(--text-muted)]" : "bg-brand-red/60"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function CancellationPanel({ report }: { report: CashReportResponse }) {
  const fa = report.financial_attention;
  if (fa.canceled_orders === 0) return null;
  const cancelRate = report.summary.total_orders > 0
    ? (fa.canceled_orders / report.summary.total_orders) * 100
    : 0;
  return (
    <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <PanelHeader icon={XCircle} title="Análise de cancelamentos" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricTile label="Cancelamentos" value={String(fa.canceled_orders)} icon={XCircle} tone="danger" meta="Pedidos cancelados no período" />
          <MetricTile label="Receita perdida" value={currency.format(fa.canceled_total)} icon={TrendingDown} tone="danger" meta="Valor total cancelado" />
          <MetricTile label="Taxa de cancelamento" value={`${cancelRate.toFixed(1)}%`} icon={AlertCircle} tone={cancelRate > 10 ? "warning" : "neutral"} meta={cancelRate > 10 ? "Acima do ideal: 10%" : "Dentro da faixa esperada"} />
        </div>
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 5 — PEDIDOS
// ════════════════════════════════════════════════════════════════════════════

function SectionOrders({ orders }: { orders: OrderRecord[] }) {
  const [filter, setFilter] = useState<OrderFilter>("TODOS");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    NA_FILA:                 { label: "Na fila",      cls: "bg-blue-500/10 text-blue-600" },
    PRONTO:                  { label: "Pronto",        cls: "bg-emerald-500/10 text-emerald-600" },
    ENTREGUE:                { label: "Entregue",      cls: "bg-[var(--bg-subtle)] text-[var(--text-secondary)]" },
    CANCELADO:               { label: "Cancelado",     cls: "bg-red-500/10 text-red-600" },
    AGUARDANDO_CONFIRMACAO:  { label: "Aguardando",    cls: "bg-amber-500/10 text-amber-600" },
    AGUARDANDO_PAGAMENTO:    { label: "Ag. pagamento", cls: "bg-amber-500/10 text-amber-600" },
    EXPIRADO:                { label: "Expirado",      cls: "bg-[var(--bg-subtle)] text-[var(--text-muted)]" },
  };

  const filtered = useMemo(() => {
    let result = orders;
    if (filter === "PAGOS")      result = result.filter((o) => o.payment_status === "PAID");
    else if (filter === "PENDENTES") result = result.filter((o) => o.payment_status === "PENDING" && o.status !== "CANCELADO" && o.status !== "EXPIRADO");
    else if (filter === "CANCELADOS") result = result.filter((o) => o.status === "CANCELADO");
    else if (filter === "DESISTENCIAS") result = result.filter((o) => o.status === "EXPIRADO");
    if (search.trim()) {
      const q = search.trim();
      result = result.filter((o) => String(o.daily_number).padStart(3, "0").includes(q));
    }
    return result;
  }, [orders, filter, search]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);

  const chips: { key: OrderFilter; label: string; count: number }[] = [
    { key: "TODOS",     label: "Todos",      count: orders.length },
    { key: "PAGOS",     label: "Pagos",      count: orders.filter((o) => o.payment_status === "PAID").length },
    { key: "PENDENTES", label: "Pendentes",  count: orders.filter((o) => o.payment_status === "PENDING" && o.status !== "CANCELADO" && o.status !== "EXPIRADO").length },
    { key: "CANCELADOS",label: "Cancelados", count: orders.filter((o) => o.status === "CANCELADO").length },
    { key: "DESISTENCIAS", label: "Desistências", count: orders.filter((o) => o.status === "EXPIRADO").length },
  ];

  const totalReceived = filtered.filter((o) => o.payment_status === "PAID").reduce((s, o) => s + o.total_amount, 0);
  // Desistência: pedido público criado (daily_number consumido) mas nunca pago —
  // expirado por expire-pending-public-orders após ficar tempo demais em
  // AGUARDANDO_PAGAMENTO. Taxa calculada sobre o total de pedidos de origem
  // pública (source=APP), já que só esses passam por esse fluxo de expiração.
  const publicOrdersCount = orders.filter((o) => o.source === "APP").length;
  const abandonedCount = orders.filter((o) => o.status === "EXPIRADO").length;
  const abandonmentRate = publicOrdersCount > 0 ? (abandonedCount / publicOrdersCount) * 100 : 0;

  const exportCSV = () => {
    const rows = filtered.map((o) => {
      const d = getSaleDate(o);
      return [
        `#${String(o.daily_number).padStart(3, "0")}`,
        o.type,
        o.status,
        o.payment_method,
        o.total_amount.toFixed(2).replace(".", ","),
        (o.discount_amount ?? 0).toFixed(2).replace(".", ","),
        longDate.format(d),
        reportTimeFormatter.format(d),
      ];
    });
    downloadCSV(
      `pedidos-${new Date().toISOString().substring(0, 10)}.csv`,
      ["Número", "Tipo", "Status", "Pagamento", "Valor", "Desconto", "Data", "Hora"],
      rows,
    );
  };

  return (
    <div className="space-y-4">
      <ReportSectionHeading eyebrow="Pedidos" title="Rastreie a origem de cada indicador" />
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Filtrados",   value: String(filtered.length), icon: Filter, tone: "info" as const },
          { label: "Total",       value: String(orders.length), icon: ListOrdered, tone: "neutral" as const },
          { label: "Recebido",    value: currency.format(totalReceived), icon: Banknote, tone: "success" as const },
          { label: "Ticket médio",value: currency.format(filtered.filter((o) => o.payment_status === "PAID").length > 0 ? totalReceived / filtered.filter((o) => o.payment_status === "PAID").length : 0), icon: CreditCard, tone: "brand" as const },
          { label: "Desistência", value: publicOrdersCount > 0 ? `${abandonmentRate.toFixed(1)}%` : "—", icon: XCircle, tone: abandonmentRate > 0 ? "warning" as const : "neutral" as const },
        ].map((s) => (
          <MetricTile key={s.label} label={s.label} value={s.value} icon={s.icon} tone={s.tone} />
        ))}
      </div>

      <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
        <CardContent className="p-4 md:p-5">
          {/* Export */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <PanelHeader icon={ListOrdered} title="Registro de pedidos" />
            <button
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-black text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar por número do pedido..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] pl-10 pr-4 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-brand-red/50 focus:outline-none"
            />
          </div>

          {/* Filter chips */}
          <div className="mb-4 flex gap-2 overflow-x-auto hide-scrollbar">
            {chips.map((c) => (
              <button
                key={c.key}
                onClick={() => { setFilter(c.key); setPage(1); }}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
                  filter === c.key ? "bg-brand-red text-white" : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
                }`}
              >
                {c.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${filter === c.key ? "bg-white/20" : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"}`}>
                  {c.count}
                </span>
              </button>
            ))}
          </div>

          {/* Orders list */}
          {filtered.length === 0 ? (
            <EmptyPanel text="Nenhum pedido com esse filtro." />
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {paginated.map((order) => {
                const st = STATUS_LABELS[order.status] ?? { label: order.status, cls: "bg-[var(--bg-subtle)] text-[var(--text-secondary)]" };
                const pm = PAYMENT_META[order.payment_method] ?? PAYMENT_META.ALL;
                const PayIcon = pm.icon;
                const hasDiscount = order.discount_amount != null && order.discount_amount > 0;
                return (
                  <div key={order.id} className="flex items-center gap-3 py-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red text-xs font-black text-white">
                      #{String(order.daily_number).padStart(3, "0")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${st.cls}`}>{st.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          order.type === "ENTREGA" ? "bg-amber-500/10 text-amber-700" :
                          order.type === "VIAGEM" ? "bg-violet-500/10 text-violet-700" :
                          "bg-blue-500/10 text-blue-700"
                        }`}>
                          {order.type === "ENTREGA" ? "Entrega" : order.type === "VIAGEM" ? "Retirada" : "Balcão"}
                        </span>
                        {hasDiscount && (
                          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-black text-red-600">
                            -{currency.format(order.discount_amount!)}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                        {longDate.format(getSaleDate(order))} · {reportTimeFormatter.format(getSaleDate(order))}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-black text-[var(--text-primary)]">{currency.format(order.total_amount)}</p>
                      <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-[var(--text-muted)]">
                        <PayIcon className="h-3 w-3" />
                        <span>{pm.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {paginated.length < filtered.length && (
            <button
              onClick={() => setPage((p) => p + 1)}
              className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] py-3 text-sm font-black text-[var(--text-secondary)] hover:bg-[var(--border)]"
            >
              Carregar mais ({filtered.length - paginated.length} restantes)
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">{children}</p>
      <span className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}

function PanelHeader({ icon: Icon, title, action }: { icon: React.ElementType; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function ExportCsvButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-black text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] print:hidden"
      title="Exportar CSV"
    >
      <Download className="h-3 w-3" strokeWidth={2} />
      CSV
    </button>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] p-4 text-center text-sm font-medium text-[var(--text-muted)]">{text}</p>;
}
