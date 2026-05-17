"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Banknote,
  Clock,
  CreditCard,
  Gift,
  Info,
  Loader2,
  QrCode,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Trophy,
  Wallet,
  XCircle,
  Zap,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
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

// ── Formatters ────────────────────────────────────────────────────────────────

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

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

  // Pending payments alert
  if (summary.pedidosPendentes > 0) {
    insights.push({
      icon: AlertTriangle,
      severity: "warning",
      text: `${summary.pedidosPendentes} pedido${summary.pedidosPendentes > 1 ? "s" : ""} ainda sem pagamento — total de ${currency.format(summary.totalPendente)}.`,
    });
  }

  // Dominant payment method
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
        text: `${label} concentra ${pct}% das vendas hoje (${currency.format(topPayment.total)}).`,
      });
    }
  }

  // Peak hour
  if (summary.peakHour) {
    const h = summary.peakHour.start;
    const end = (h + 1) % 24;
    insights.push({
      icon: Zap,
      severity: "info",
      text: `Hora de pico: ${String(h).padStart(2, "0")}h–${String(end).padStart(2, "0")}h. Prepare-se para o rush.`,
    });
  }

  // Star product
  if (topProducts.length > 0) {
    const star = topProducts[0];
    insights.push({
      icon: Trophy,
      severity: "positive",
      text: `Mais pedido hoje: ${star.name} — ${star.quantity} unidades (${currency.format(star.revenue)}).`,
    });
  }

  // High cancellation
  if (summary.taxaCancelamento > 8 && summary.pedidosCancelados > 1) {
    insights.push({
      icon: XCircle,
      severity: "warning",
      text: `Taxa de cancelamento alta: ${summary.taxaCancelamento.toFixed(1)}% (${summary.pedidosCancelados} pedidos cancelados).`,
    });
  }

  // Courtesies
  if (summary.pedidosCortesia > 0) {
    insights.push({
      icon: Gift,
      severity: "info",
      text: `${summary.pedidosCortesia} cortesia${summary.pedidosCortesia > 1 ? "s" : ""} concedida${summary.pedidosCortesia > 1 ? "s" : ""} hoje — ${currency.format(summary.totalCortesia)}.`,
    });
  }

  // Good day message
  if (insights.length === 0 && summary.totalPedidos > 0) {
    insights.push({
      icon: CheckCircle2,
      severity: "positive",
      text: "Tudo certo! Nenhum alerta operacional no momento.",
    });
  }

  return insights.slice(0, 3);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CaixaPage() {
  const [data, setData] = useState<CaixaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [isLive, setIsLive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { currentBranchId, currentBranch } = useBranch();
  const { isAdmin, isLoading: userLoading } = useUser();
  const router = useRouter();

  // Somente ADMIN pode ver o caixa
  useEffect(() => {
    if (!userLoading && !isAdmin) {
      router.replace("/app/pedidos");
    }
  }, [isAdmin, userLoading, router]);

  const loadCash = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError("");
    try {
      setData(await cashApi.getDaySummary(currentBranchId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar caixa");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentBranchId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const next = await cashApi.getDaySummary(currentBranchId);
        if (!cancelled) setData(next);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar caixa");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-refresh every 60s when page is visible
  useEffect(() => {
    const startInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === "visible") loadCash(true);
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
    startInterval();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadCash]);

  const lastUpdate = data?.generatedAt ? timeFormatter.format(new Date(data.generatedAt)) : null;
  const insights = useMemo(() => (data ? buildInsights(data) : []), [data]);

  return (
    <div className="flex h-full flex-col bg-[var(--bg-base)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary)] sm:text-lg">
              Caixa do dia
              {currentBranch && (
                <span className="ml-2 rounded-full bg-brand-charcoal px-2 py-0.5 text-[11px] font-semibold text-white">
                  {currentBranch.code} · {currentBranch.name}
                </span>
              )}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {lastUpdate && (
                <p className="text-[11px] text-[var(--text-muted)]">
                  Atualizado às {lastUpdate}
                </p>
              )}
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
          </div>
          <div className="flex items-center gap-2">
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
              <Skeleton className="h-48 w-full rounded-3xl" />
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
              title="Sem vendas hoje"
              description="Os pedidos do dia aparecerão aqui assim que forem criados."
            />
          ) : (
            <>
              {/* Hero */}
              <DayHero data={data} />

              {/* Status chips */}
              <StatusStrip data={data} />

              {/* Hoje em números */}
              <DayMetricsPanel data={data} />

              {/* Insights */}
              {insights.length > 0 && <InsightsSection insights={insights} />}

              {/* Payments */}
              <PaymentsCard items={data.paymentBreakdown} received={data.summary.totalRecebido} />

              {/* Admin CTA */}
              {data.role === "ADMIN" && <AdminCTA />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Day Hero ──────────────────────────────────────────────────────────────────

function DayHero({ data }: { data: CaixaData }) {
  const { summary } = data;
  const paidPct = summary.totalPedidos > 0
    ? Math.round((summary.pedidosPagos / summary.totalPedidos) * 100)
    : 0;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[var(--bg-inverse)] shadow-[var(--shadow-lg)]">
      {/* Glow decorations sutis */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-red/15 blur-3xl" />

      <div className="relative px-6 py-8 md:px-8 md:py-10">
        <p className="text-[11px] font-semibold text-zinc-400">Recebido hoje</p>

        {/* Valor principal — R$ menor que o valor (brief) */}
        <p className="mt-2 text-5xl font-semibold tracking-tight text-white md:text-6xl tabular-nums">
          <span className="text-2xl text-zinc-400 mr-1 font-medium">R$</span>
          {currency.format(summary.totalRecebido).replace("R$", "").trim()}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Stat label="Bruto" value={currency.format(summary.totalBruto)} />
          {summary.pedidosPendentes > 0 && (
            <Stat label="Pendente" value={currency.format(summary.totalPendente)} warn />
          )}
          {summary.totalDescontos > 0 && (
            <Stat label="Descontos" value={`-${currency.format(summary.totalDescontos)}`} />
          )}
          <Stat label="Ticket médio" value={currency.format(summary.ticketMedio)} />
          {summary.peakHour && (
            <Stat label="Pico" value={`${String(summary.peakHour.start).padStart(2,"0")}h`} />
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

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] px-3.5 py-2.5 ring-1 ring-white/[0.08]">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${warn ? "text-amber-300" : "text-white"}`}>{value}</p>
    </div>
  );
}

// ── Status strip ──────────────────────────────────────────────────────────────

function StatusStrip({ data }: { data: CaixaData }) {
  const { summary } = data;
  // Per brief: Pagos=success, Pendentes=warning, Cancelados=danger, Cortesias=neutral
  // Mesmo tamanho visual em todos (não esmaecer os zerados).
  const tiles: { label: string; count: number; tone: "success" | "warning" | "danger" | "neutral" }[] = [
    { label: "Pagos",      count: summary.pedidosPagos,       tone: "success" },
    { label: "Pendentes",  count: summary.pedidosPendentes,   tone: "warning" },
    { label: "Cancelados", count: summary.pedidosCancelados,  tone: "danger"  },
    { label: "Cortesias",  count: summary.pedidosCortesia,    tone: "neutral" },
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
            <div className="min-w-0">
              <p className={`text-[11px] font-medium ${m.fg}`}>{t.label}</p>
              <p className={`text-2xl font-semibold leading-none tabular-nums ${m.fg}`}>{t.count}</p>
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

function DayMetricsPanel({ data }: { data: CaixaData }) {
  const { summary, topProducts } = data;
  if (summary.totalPedidos === 0) return null;

  const peakLabel = summary.peakHour
    ? `${String(summary.peakHour.start).padStart(2, "0")}h–${String((summary.peakHour.start + 1) % 24).padStart(2, "0")}h`
    : null;

  const topThree = topProducts.slice(0, 3);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard icon={ShoppingBag} label="Crepes vendidos" value={String(summary.crepesSold)} color="text-brand-red" />
      {peakLabel && <MetricCard icon={Zap} label="Hora de pico" value={peakLabel} color="text-[var(--status-warning)]" />}
      {summary.avgDeliveryMinutes != null && (
        <MetricCard icon={Clock} label="Tempo médio" value={`${summary.avgDeliveryMinutes}min`} color="text-[var(--status-info)]" />
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

function MetricCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: string;
}) {
  return (
    <div className="rounded-2xl bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)] ring-1 ring-[var(--border)]">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`h-3.5 w-3.5 ${color}`} strokeWidth={1.75} />
        <p className="text-[11px] font-medium text-[var(--text-muted)]">{label}</p>
      </div>
      <p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">{value}</p>
    </div>
  );
}

// ── Payments ──────────────────────────────────────────────────────────────────

function PaymentsCard({ items }: { items: PaymentBreakdown[]; received: number }) {
  const active = items.filter((i) => i.count > 0 && i.method !== "PENDING");
  const pending = items.find((i) => i.method === "PENDING" && i.count > 0);
  // Denominador = soma dos pagamentos reais (não orders.total_amount) para % sempre 100%
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

        {/* Pending */}
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
