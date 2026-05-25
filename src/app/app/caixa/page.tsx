"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Banknote,
  CalendarDays,
  Clock,
  CreditCard,
  Gift,
  Info,
  Loader2,
  QrCode,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
  XCircle,
  Zap,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  CaixaData,
  PaymentBreakdown,
  cashApi,
} from "@/lib/api/cash-api";
import { PaymentMethod } from "@/types/pdv";
import { useBranch } from "@/contexts/BranchContext";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import { getBusinessDayRange } from "@/lib/utils/business-day";

// ── Formatters ────────────────────────────────────────────────────────────────

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function formatBusinessDate(label: string) {
  // label = "YYYY-MM-DD"
  const [y, m, d] = label.split("-").map(Number);
  return dateFormatter.format(new Date(y, m - 1, d));
}

function todayLabel() {
  return getBusinessDayRange().label;
}

function previousDayDate(fromDate?: Date) {
  const ref = fromDate ?? new Date();
  ref.setDate(ref.getDate() - 1);
  return ref;
}

// ── Payment config ────────────────────────────────────────────────────────────

const PAYMENT_META: Record<PaymentMethod, {
  icon: React.ElementType; label: string;
  iconCls: string; barCls: string; cardBg: string;
  textCls: string; subtextCls: string; trackCls: string;
}> = {
  PIX:         { icon: QrCode,      label: "PIX",      iconCls: "bg-teal-100 text-teal-600",     barCls: "bg-teal-500",    cardBg: "bg-teal-50",    textCls: "text-teal-900",    subtextCls: "text-teal-600",    trackCls: "bg-teal-100" },
  CASH:        { icon: Banknote,    label: "Dinheiro", iconCls: "bg-emerald-100 text-emerald-600", barCls: "bg-emerald-500", cardBg: "bg-emerald-50", textCls: "text-emerald-900", subtextCls: "text-emerald-600", trackCls: "bg-emerald-100" },
  DEBIT_CARD:  { icon: CreditCard,  label: "Débito",   iconCls: "bg-blue-100 text-blue-600",     barCls: "bg-blue-500",    cardBg: "bg-blue-50",    textCls: "text-blue-900",    subtextCls: "text-blue-600",    trackCls: "bg-blue-100" },
  CREDIT_CARD: { icon: CreditCard,  label: "Crédito",  iconCls: "bg-violet-100 text-violet-600", barCls: "bg-violet-500",  cardBg: "bg-violet-50",  textCls: "text-violet-900",  subtextCls: "text-violet-600",  trackCls: "bg-violet-100" },
  IFOOD:       { icon: Smartphone,  label: "iFood",    iconCls: "bg-orange-100 text-orange-600", barCls: "bg-orange-500",  cardBg: "bg-orange-50",  textCls: "text-orange-900",  subtextCls: "text-orange-600",  trackCls: "bg-orange-100" },
  COURTESY:    { icon: Gift,        label: "Cortesia", iconCls: "bg-pink-100 text-pink-600",     barCls: "bg-pink-400",    cardBg: "bg-pink-50",    textCls: "text-pink-900",    subtextCls: "text-pink-600",    trackCls: "bg-pink-100" },
  PENDING:     { icon: Clock,       label: "Pendente", iconCls: "bg-amber-100 text-amber-600",   barCls: "bg-amber-400",   cardBg: "bg-amber-50",   textCls: "text-amber-900",   subtextCls: "text-amber-600",   trackCls: "bg-amber-100" },
};

// ── Delta helpers ─────────────────────────────────────────────────────────────

function delta(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function DeltaBadge({ current, previous, invertColor }: { current: number; previous: number; invertColor?: boolean }) {
  const pct = delta(current, previous);
  if (pct === null) return null;
  const positive = invertColor ? pct < 0 : pct > 0;
  const Icon = pct > 0 ? TrendingUp : TrendingDown;
  const cls = pct === 0
    ? "text-zinc-400"
    : positive
    ? "text-emerald-400"
    : "text-red-400";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${cls}`}>
      <Icon className="h-3 w-3" strokeWidth={2} />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ── Insight generation ────────────────────────────────────────────────────────

type InsightSeverity = "positive" | "info" | "warning";

interface DayInsight {
  icon: React.ElementType;
  text: string;
  severity: InsightSeverity;
}

function buildInsights(data: CaixaData): DayInsight[] {
  const { summary, paymentBreakdown, topProducts } = data;
  const insights: DayInsight[] = [];

  if (summary.pedidosPendentes > 0) {
    insights.push({
      icon: AlertTriangle,
      severity: "warning",
      text: `${summary.pedidosPendentes} pedido${summary.pedidosPendentes > 1 ? "s" : ""} ainda sem pagamento — total de ${currency.format(summary.totalPendente)}.`,
    });
  }

  const topPayment = paymentBreakdown
    .filter((p) => p.method !== "PENDING" && p.method !== "COURTESY" && p.count > 0)
    .sort((a, b) => b.total - a.total)[0];
  if (topPayment && summary.totalRecebido > 0) {
    const pct = Math.round((topPayment.total / summary.totalRecebido) * 100);
    if (pct >= 50) {
      const label = PAYMENT_META[topPayment.method]?.label ?? topPayment.label;
      insights.push({
        icon: TrendingUp,
        severity: "info",
        text: `${label} concentra ${pct}% das vendas (${currency.format(topPayment.total)}).`,
      });
    }
  }

  if (summary.peakHour) {
    const h = summary.peakHour.start;
    const end = (h + 1) % 24;
    insights.push({
      icon: Zap,
      severity: "info",
      text: `Hora de pico: ${String(h).padStart(2, "0")}h–${String(end).padStart(2, "0")}h.`,
    });
  }

  if (topProducts.length > 0) {
    const star = topProducts[0];
    insights.push({
      icon: Trophy,
      severity: "positive",
      text: `Mais pedido: ${star.name} — ${star.quantity} unidades (${currency.format(star.revenue)}).`,
    });
  }

  if (summary.taxaCancelamento > 8 && summary.pedidosCancelados > 1) {
    insights.push({
      icon: XCircle,
      severity: "warning",
      text: `Taxa de cancelamento alta: ${summary.taxaCancelamento.toFixed(1)}% (${summary.pedidosCancelados} pedidos).`,
    });
  }

  if (summary.pedidosCortesia > 0) {
    insights.push({
      icon: Gift,
      severity: "info",
      text: `${summary.pedidosCortesia} cortesia${summary.pedidosCortesia > 1 ? "s" : ""} concedida${summary.pedidosCortesia > 1 ? "s" : ""} — ${currency.format(summary.totalCortesia)}.`,
    });
  }

  if (insights.length === 0 && summary.totalPedidos > 0) {
    insights.push({
      icon: CheckCircle2,
      severity: "positive",
      text: "Tudo certo! Nenhum alerta operacional no momento.",
    });
  }

  return insights.slice(0, 4);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CaixaPage() {
  const [data, setData] = useState<CaixaData | null>(null);
  const [prevData, setPrevData] = useState<CaixaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [selectedDayLabel, setSelectedDayLabel] = useState<string>(todayLabel);
  const [showComparison, setShowComparison] = useState(false);
  const [isCompLoading, setIsCompLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { currentBranchId, currentBranch } = useBranch();
  const { isAdmin, isLoading: userLoading } = useUser();
  const router = useRouter();

  const isToday = selectedDayLabel === todayLabel();

  // Somente ADMIN pode ver o caixa
  useEffect(() => {
    if (!userLoading && !isAdmin) {
      router.replace("/app/pedidos");
    }
  }, [isAdmin, userLoading, router]);

  // Converte label "YYYY-MM-DD" → Date (meio-dia SP para evitar offset)
  const labelToDate = useCallback((label: string) => {
    const [y, m, d] = label.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }, []);

  const loadCash = useCallback(async (refreshing = false, dayLabel = selectedDayLabel) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError("");
    try {
      const date = dayLabel !== todayLabel() ? labelToDate(dayLabel) : undefined;
      setData(await cashApi.getDaySummary(currentBranchId, date));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar caixa");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentBranchId, selectedDayLabel, labelToDate]);

  const loadComparison = useCallback(async (dayLabel: string) => {
    setIsCompLoading(true);
    try {
      const refDate = labelToDate(dayLabel);
      const prevDate = previousDayDate(refDate);
      setPrevData(await cashApi.getDaySummary(currentBranchId, prevDate));
    } catch {
      setPrevData(null);
    } finally {
      setIsCompLoading(false);
    }
  }, [currentBranchId, labelToDate]);

  // Carrega quando muda dia ou filial
  useEffect(() => {
    loadCash(false, selectedDayLabel);
  }, [selectedDayLabel, currentBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showComparison) {
      loadComparison(selectedDayLabel);
    } else {
      setPrevData(null);
    }
  }, [showComparison, selectedDayLabel, currentBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh a cada 60s só quando está no dia de hoje
  useEffect(() => {
    const startInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === "visible" && isToday) loadCash(true);
      }, 60_000);
      setIsLive(true);
    };
    const stopInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsLive(false);
    };
    const onVisibility = () => {
      document.visibilityState === "visible" ? startInterval() : stopInterval();
    };
    if (isToday) {
      startInterval();
    } else {
      stopInterval();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadCash, isToday]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; // "YYYY-MM-DD"
    if (!val) return;
    // Garante que não ultrapassa hoje
    const today = todayLabel();
    const chosen = val > today ? today : val;
    setSelectedDayLabel(chosen);
    setShowDatePicker(false);
  };

  const goToPrevDay = () => {
    const refDate = labelToDate(selectedDayLabel);
    const prev = new Date(refDate);
    prev.setDate(prev.getDate() - 1);
    const { label } = getBusinessDayRange(prev);
    setSelectedDayLabel(label);
  };

  const goToNextDay = () => {
    const refDate = labelToDate(selectedDayLabel);
    const next = new Date(refDate);
    next.setDate(next.getDate() + 1);
    const { label } = getBusinessDayRange(next);
    const today = todayLabel();
    if (label <= today) setSelectedDayLabel(label);
  };

  const lastUpdate = data?.generatedAt ? timeFormatter.format(new Date(data.generatedAt)) : null;
  const insights = useMemo(() => (data ? buildInsights(data) : []), [data]);

  return (
    <div className="flex h-full flex-col bg-[var(--bg-base)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 md:px-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary)] sm:text-lg flex items-center gap-2 flex-wrap">
              Caixa
              {currentBranch && (
                <span className="rounded-full bg-brand-charcoal px-2 py-0.5 text-[11px] font-semibold text-white">
                  {currentBranch.code} · {currentBranch.name}
                </span>
              )}
              {!isToday && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  Histórico
                </span>
              )}
            </h1>
            {lastUpdate && isToday && (
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] text-[var(--text-muted)]">Atualizado às {lastUpdate}</p>
                {isLive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--status-success-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--status-success)]">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--status-success)] opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--status-success)]" />
                    </span>
                    ao vivo
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Seletor de data */}
            <div className="relative flex items-center gap-0.5">
              <button
                onClick={goToPrevDay}
                className="inline-flex h-9 w-8 items-center justify-center rounded-l-xl border border-r-0 border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] active:scale-95"
                title="Dia anterior"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => {
                  setShowDatePicker((v) => !v);
                  setTimeout(() => dateInputRef.current?.showPicker?.(), 50);
                }}
                className="inline-flex h-9 items-center gap-1.5 border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] active:scale-[0.97]"
                title="Selecionar dia"
              >
                <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>{isToday ? "Hoje" : formatBusinessDate(selectedDayLabel)}</span>
              </button>
              {!isToday && (
                <button
                  onClick={goToNextDay}
                  className="inline-flex h-9 w-8 items-center justify-center rounded-r-xl border border-l-0 border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] active:scale-95"
                  title="Próximo dia"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                </button>
              )}
              {isToday && (
                <button
                  onClick={goToNextDay}
                  className="inline-flex h-9 w-8 cursor-not-allowed items-center justify-center rounded-r-xl border border-l-0 border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-40"
                  disabled
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                </button>
              )}
              {/* Input date invisível — acionado pelo botão */}
              <input
                ref={dateInputRef}
                type="date"
                max={todayLabel()}
                value={selectedDayLabel}
                onChange={handleDateChange}
                className="absolute inset-0 cursor-pointer opacity-0 w-full h-full"
                tabIndex={-1}
              />
            </div>

            {/* Comparação */}
            <button
              onClick={() => setShowComparison((v) => !v)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors active:scale-[0.97] ${
                showComparison
                  ? "border-brand-red/30 bg-brand-red/5 text-brand-red"
                  : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              }`}
              title="Comparar com dia anterior"
            >
              {isCompLoading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.75} />}
              <span className="hidden sm:inline">Comparar</span>
            </button>

            {data?.role === "ADMIN" && (
              <Link href="/app/caixa/relatorio">
                <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-charcoal px-3 text-xs font-semibold text-white hover:bg-brand-black active:scale-[0.97] sm:px-4">
                  <BarChart3 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Relatório</span>
                </span>
              </Link>
            )}
            <button
              onClick={() => loadCash(true)}
              disabled={isLoading || isRefreshing}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] active:scale-[0.97] disabled:opacity-50 sm:px-4"
            >
              {isRefreshing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />}
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-4 px-4 pb-28 pt-5 md:px-6 md:pt-6">
          {isLoading && !data ? (
            <div className="space-y-4">
              <Skeleton className="h-56 w-full rounded-3xl" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
              <Skeleton className="h-32 w-full rounded-3xl" />
            </div>
          ) : error ? (
            <ErrorState
              title="Não foi possível carregar o caixa"
              message={error}
              onRetry={() => loadCash(false)}
            />
          ) : !data ? null : data.summary.totalPedidos === 0 ? (
            <EmptyState
              icon={Banknote}
              title="Sem vendas neste dia"
              description="Nenhum pedido registrado neste período."
            />
          ) : (
            <>
              <DayHero data={data} prevData={showComparison ? prevData : null} />
              {/* Decomposição honesta do faturamento (sem "−" enganoso) */}
              <DayBreakdown data={data} />
              <StatusStrip data={data} prevData={showComparison ? prevData : null} />
              <DayMetricsPanel data={data} prevData={showComparison ? prevData : null} />
              {insights.length > 0 && <InsightsSection insights={insights} />}
              <PaymentsCard items={data.paymentBreakdown} received={data.summary.totalRecebido} />
              {data.role === "ADMIN" && <AdminCTA />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Day Hero ──────────────────────────────────────────────────────────────────

function DayHero({ data, prevData }: { data: CaixaData; prevData: CaixaData | null }) {
  const { summary } = data;
  const paidPct = summary.totalPedidos > 0
    ? Math.round((summary.pedidosPagos / summary.totalPedidos) * 100)
    : 0;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[var(--bg-inverse)] shadow-[var(--shadow-lg)]">
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-red/15 blur-3xl" />

      <div className="relative px-6 py-7 md:px-8 md:py-9">
        <p className="text-[11px] font-semibold text-zinc-400">Líquido recebido hoje</p>

        <div className="mt-2 flex items-end gap-3 flex-wrap">
          <p className="text-5xl font-semibold tracking-tight text-white md:text-6xl tabular-nums">
            <span className="text-2xl text-zinc-400 mr-1 font-medium">R$</span>
            {currency.format(summary.totalLiquido).replace("R$", "").trim()}
          </p>
          {prevData && (
            <DeltaBadge current={summary.totalLiquido} previous={prevData.summary.totalLiquido} />
          )}
        </div>

        {/* Stats row — mobile: 2 col, desktop: wrap.
            "Faturamento" (= totalBruto) substitui "Bruto" — total_amount já é
            líquido de desconto; "Bruto" sugeria valor pré-desconto e iludia. */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Stat label="Faturamento" value={currency.format(summary.totalBruto)} />
          {summary.pedidosPendentes > 0 && (
            <Stat label="Pendente" value={currency.format(summary.totalPendente)} warn />
          )}
          {summary.totalCortesia > 0 && (
            <Stat
              label={`Cortesia (${summary.pedidosCortesia})`}
              value={currency.format(summary.totalCortesia)}
              highlight="pink"
              delta={prevData ? <DeltaBadge current={summary.totalCortesia} previous={prevData.summary.totalCortesia} invertColor /> : null}
            />
          )}
          {summary.totalIFood > 0 && (
            <Stat
              label="iFood"
              value={currency.format(summary.totalIFood)}
              highlight="orange"
              delta={prevData ? <DeltaBadge current={summary.totalIFood} previous={prevData.summary.totalIFood} /> : null}
            />
          )}
          {summary.totalDescontos > 0 && (
            // Sem o "-" enganoso: o desconto já está incluído no faturamento;
            // não há subtração visual que reflita realidade.
            <Stat label="Descontos" value={currency.format(summary.totalDescontos)} />
          )}
          <Stat
            label="Ticket médio"
            value={currency.format(summary.ticketMedio)}
            delta={prevData ? <DeltaBadge current={summary.ticketMedio} previous={prevData.summary.ticketMedio} /> : null}
          />
          {summary.peakHour && (
            <Stat label="Pico" value={`${String(summary.peakHour.start).padStart(2, "0")}h`} />
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-6 space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-white/30"
              style={{ width: `${paidPct}%`, transition: "width 700ms ease" }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-medium text-zinc-500">
            <span>{summary.pedidosPagos} de {summary.totalPedidos} pedidos pagos</span>
            <span className="text-white/50">{paidPct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label, value, warn, highlight, delta: deltaBadge,
}: {
  label: string; value: string; warn?: boolean; highlight?: "pink" | "orange"; delta?: React.ReactNode;
}) {
  const bg = highlight === "pink"
    ? "bg-pink-500/15 ring-pink-400/20"
    : highlight === "orange"
    ? "bg-orange-500/15 ring-orange-400/20"
    : "bg-white/[0.06] ring-white/[0.08]";
  const textColor = highlight === "pink"
    ? "text-pink-200"
    : highlight === "orange"
    ? "text-orange-200"
    : warn
    ? "text-amber-300"
    : "text-white";
  return (
    <div className={`rounded-2xl ${bg} px-3.5 py-2.5 ring-1`}>
      <p className="text-[11px] text-zinc-400">{label}</p>
      <div className="flex items-center gap-1.5 mt-0.5">
        <p className={`text-sm font-semibold tabular-nums ${textColor}`}>{value}</p>
        {deltaBadge}
      </div>
    </div>
  );
}

// ── Day breakdown (decomposição honesta do faturamento) ──────────────────────
//
// Regra (cash-api.ts):
//   totalBruto = Σ total_amount de pedidos NÃO-cancelados (PAID + PENDING + COURTESY).
//                Já líquido de desconto (orders.total_amount é o valor final).
//     ├─ totalRecebido (PAID)
//     ├─ totalPendente (PENDING / PARTIAL)
//     └─ totalCortesia (COURTESY)
//   totalDescontos = Σ discount_amount dos não-cancelados (informativo; já
//                    refletido em totalBruto, não subtrai de nada).
//   totalCancelado = Σ total_amount dos cancelados (fora de totalBruto).
//
// Logo: totalRecebido + totalPendente + totalCortesia ≈ totalBruto.
function DayBreakdown({ data }: { data: CaixaData }) {
  const { summary } = data;
  if (summary.totalBruto <= 0) return null;

  const max = summary.totalBruto || 1;
  const pct = (v: number) => (v > 0 ? Math.max((v / max) * 100, 2) : 0);

  const destinations: { label: string; value: number; barCls: string; textCls: string }[] = [
    { label: "Recebido", value: summary.totalRecebido, barCls: "bg-emerald-500", textCls: "text-emerald-700" },
    { label: "Pendente", value: summary.totalPendente, barCls: "bg-amber-400",   textCls: "text-amber-700"   },
    { label: "Cortesia", value: summary.totalCortesia, barCls: "bg-pink-400",    textCls: "text-pink-700"    },
  ].filter((d) => d.value > 0);

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            Composição do faturamento
          </p>
          <p className="mt-1 text-2xl font-black tabular-nums text-[var(--text-primary)]">
            {currency.format(summary.totalBruto)}
          </p>
          <p className="text-[11px] font-medium text-[var(--text-muted)]">
            Pedidos não-cancelados (descontos já aplicados)
          </p>
        </div>
      </div>

      {/* Barra empilhada: cada destino proporcional ao faturamento */}
      <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
        {destinations.map((d) => (
          <div key={d.label} className={`h-full ${d.barCls}`} style={{ width: `${(d.value / max) * 100}%` }} />
        ))}
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
                <p className={`text-sm font-black tabular-nums ${d.textCls}`}>
                  {currency.format(d.value)}
                  <span className="ml-1.5 text-[11px] font-bold text-[var(--text-muted)]">
                    ({Math.round((d.value / summary.totalBruto) * 100)}%)
                  </span>
                </p>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                <div className={`h-full rounded-full ${d.barCls}`} style={{ width: `${pct(d.value)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Visões paralelas — não subtraem do faturamento */}
      {(summary.totalDescontos > 0 || summary.totalCancelado > 0) && (
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            À parte
          </p>
          <div className="mt-2 space-y-1.5">
            {summary.totalDescontos > 0 && (
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-bold text-[var(--text-secondary)]">
                  Descontos concedidos
                  <span className="ml-1.5 text-[10px] font-medium text-[var(--text-muted)]">
                    (já refletido no faturamento)
                  </span>
                </p>
                <p className="text-xs font-black tabular-nums text-[var(--text-secondary)]">
                  {currency.format(summary.totalDescontos)}
                </p>
              </div>
            )}
            {summary.totalCancelado > 0 && (
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-bold text-[var(--text-secondary)]">
                  Cancelados
                  <span className="ml-1.5 text-[10px] font-medium text-[var(--text-muted)]">
                    (fora do faturamento)
                  </span>
                </p>
                <p className="text-xs font-black tabular-nums text-[var(--text-secondary)]">
                  {currency.format(summary.totalCancelado)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Status strip ──────────────────────────────────────────────────────────────

function StatusStrip({ data, prevData }: { data: CaixaData; prevData: CaixaData | null }) {
  const { summary } = data;
  const tiles: { label: string; count: number; prevCount?: number; tone: "success" | "warning" | "danger" | "neutral" }[] = [
    { label: "Pagos",      count: summary.pedidosPagos,      prevCount: prevData?.summary.pedidosPagos,      tone: "success" },
    { label: "Pendentes",  count: summary.pedidosPendentes,  prevCount: prevData?.summary.pedidosPendentes,  tone: "warning" },
    { label: "Cancelados", count: summary.pedidosCancelados, prevCount: prevData?.summary.pedidosCancelados, tone: "danger"  },
    { label: "Cortesias",  count: summary.pedidosCortesia,   prevCount: prevData?.summary.pedidosCortesia,   tone: "neutral" },
  ];

  const toneMap = {
    success: { bg: "bg-[var(--status-success-bg)]", fg: "text-[var(--status-success)]" },
    warning: { bg: "bg-[var(--status-warning-bg)]", fg: "text-[var(--status-warning)]" },
    danger:  { bg: "bg-[var(--status-danger-bg)]",  fg: "text-[var(--status-danger)]"  },
    neutral: { bg: "bg-[var(--status-neutral-bg)]", fg: "text-[var(--status-neutral)]" },
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => {
        const m = toneMap[t.tone];
        return (
          <div key={t.label} className={`flex items-center gap-3 rounded-2xl ${m.bg} px-4 py-3.5`}>
            <span className={`h-2 w-2 shrink-0 rounded-full ${m.fg.replace("text-", "bg-")}`} />
            <div className="min-w-0 flex-1">
              <p className={`text-[11px] font-medium ${m.fg}`}>{t.label}</p>
              <p className={`text-2xl font-semibold leading-none tabular-nums ${m.fg}`}>{t.count}</p>
              {prevData && t.prevCount !== undefined && (
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {t.prevCount} ontem
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Insights ──────────────────────────────────────────────────────────────────

const INSIGHT_STYLE: Record<InsightSeverity, { wrap: string; icon: string; border: string }> = {
  positive: { wrap: "bg-[var(--status-success-bg)]", icon: "text-[var(--status-success)]", border: "border-l-[var(--status-success)]" },
  info:     { wrap: "bg-[var(--status-info-bg)]",    icon: "text-[var(--status-info)]",    border: "border-l-[var(--status-info)]" },
  warning:  { wrap: "bg-[var(--status-warning-bg)]", icon: "text-[var(--status-warning)]", border: "border-l-[var(--status-warning)]" },
};

function InsightsSection({ insights }: { insights: DayInsight[] }) {
  return (
    <div className="overflow-hidden rounded-3xl bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--border)]">
      <div className="border-b border-[var(--border)] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-[var(--text-muted)]" strokeWidth={1.75} />
          <p className="text-sm font-semibold text-[var(--text-primary)]">Insights do dia</p>
        </div>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {insights.map((insight, i) => {
          const style = INSIGHT_STYLE[insight.severity];
          const Icon = insight.icon;
          return (
            <div key={i} className={`flex items-start gap-3 border-l-4 ${style.border} ${style.wrap} px-5 py-3.5`}>
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.icon}`} strokeWidth={1.75} />
              <p className="text-sm leading-relaxed text-[var(--text-primary)]">{insight.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Hoje em números ───────────────────────────────────────────────────────────

function DayMetricsPanel({ data, prevData }: { data: CaixaData; prevData: CaixaData | null }) {
  const { summary, topProducts } = data;
  if (summary.totalPedidos === 0) return null;

  const peakLabel = summary.peakHour
    ? `${String(summary.peakHour.start).padStart(2, "0")}h–${String((summary.peakHour.start + 1) % 24).padStart(2, "0")}h`
    : null;

  const topThree = topProducts.slice(0, 3);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard
        icon={ShoppingBag}
        label="Crepes vendidos"
        value={String(summary.crepesSold)}
        color="text-brand-red"
        delta={prevData ? <DeltaBadge current={summary.crepesSold} previous={prevData.summary.crepesSold} /> : null}
      />
      {peakLabel && <MetricCard icon={Zap} label="Hora de pico" value={peakLabel} color="text-[var(--status-warning)]" />}
      {summary.avgDeliveryMinutes != null && (
        <MetricCard
          icon={Clock}
          label="Tempo médio"
          value={`${summary.avgDeliveryMinutes}min`}
          color="text-[var(--status-info)]"
          delta={prevData?.summary.avgDeliveryMinutes != null
            ? <DeltaBadge current={summary.avgDeliveryMinutes} previous={prevData.summary.avgDeliveryMinutes} invertColor />
            : null}
        />
      )}
      {topThree.length > 0 && (
        <div className="rounded-2xl bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)] ring-1 ring-[var(--border)] col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Trophy className="h-3.5 w-3.5 text-[var(--status-warning)]" strokeWidth={1.75} />
            <p className="text-[11px] font-medium text-[var(--text-muted)]">Mais vendidos</p>
          </div>
          <ol className="space-y-1.5">
            {topThree.map((p, i) => (
              <li key={p.name} className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[var(--text-primary)] truncate">{i + 1}. {p.name}</span>
                <span className="shrink-0 text-[11px] font-semibold text-[var(--text-muted)] tabular-nums">{p.quantity}×</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color, delta: deltaBadge }: {
  icon: React.ElementType; label: string; value: string; color: string; delta?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)] ring-1 ring-[var(--border)]">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`h-3.5 w-3.5 ${color}`} strokeWidth={1.75} />
        <p className="text-[11px] font-medium text-[var(--text-muted)]">{label}</p>
      </div>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">{value}</p>
        {deltaBadge}
      </div>
    </div>
  );
}

// ── Payments ──────────────────────────────────────────────────────────────────

function PaymentsCard({ items }: { items: PaymentBreakdown[]; received: number }) {
  const active = items.filter((i) => i.count > 0 && i.method !== "PENDING");
  const pending = items.find((i) => i.method === "PENDING" && i.count > 0);
  const totalPaid = active.reduce((sum, i) => sum + i.total, 0);
  if (active.length === 0 && !pending) return null;

  return (
    <div className="overflow-hidden rounded-3xl bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--border)]">
      <div className="border-b border-[var(--border)] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[var(--text-muted)]" strokeWidth={1.75} />
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Formas de pagamento</h2>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {active.map((item) => {
          const meta = PAYMENT_META[item.method];
          if (!meta) return null;
          const Icon = meta.icon;
          const pct = totalPaid > 0 ? Math.round((item.total / totalPaid) * 100) : 0;
          return (
            <div key={item.method} className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 ${meta.cardBg}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconCls}`}>
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div>
                    <p className={`text-sm font-semibold ${meta.textCls}`}>{meta.label}</p>
                    <p className={`text-[11px] ${meta.subtextCls}`}>{item.count} pedido{item.count !== 1 ? "s" : ""}</p>
                  </div>
                  <p className={`text-base font-semibold tabular-nums ${meta.textCls}`}>{currency.format(item.total)}</p>
                </div>
                <div className={`h-1.5 w-full overflow-hidden rounded-full ${meta.trackCls}`}>
                  <div className={`h-full rounded-full ${meta.barCls}`} style={{ width: `${pct}%`, transition: "width 700ms ease" }} />
                </div>
              </div>
              <span className={`shrink-0 text-xs font-semibold ${meta.subtextCls} w-9 text-right tabular-nums`}>{pct}%</span>
            </div>
          );
        })}

        {pending && (
          <div className="flex items-center gap-4 rounded-2xl bg-[var(--status-warning-bg)] px-4 py-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--status-warning)]/15 text-[var(--status-warning)]">
              <Clock className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--status-warning)]">Pendente</p>
              <p className="text-[11px] text-[var(--status-warning)] opacity-80">{pending.count} pedido{pending.count !== 1 ? "s" : ""}</p>
            </div>
            <p className="text-base font-semibold text-[var(--status-warning)] tabular-nums">{currency.format(pending.total)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Admin CTA ─────────────────────────────────────────────────────────────────

function AdminCTA() {
  return (
    <Link
      href="/app/caixa/relatorio"
      className="group flex items-center justify-between gap-4 rounded-3xl bg-[var(--bg-inverse)] px-6 py-5 shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] active:scale-[0.98]"
    >
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
          <BarChart3 className="h-5 w-5 text-white" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">Relatório gerencial</p>
          <p className="text-xs text-zinc-400">Análise completa de vendas e operação</p>
        </div>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-zinc-400 group-hover:translate-x-1 transition-transform" strokeWidth={1.75} />
    </Link>
  );
}
