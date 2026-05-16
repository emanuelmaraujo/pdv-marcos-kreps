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
import { LoadingState } from "@/components/feedback/LoadingState";
import { Card, CardContent } from "@/components/ui/Card";
import {
  CaixaData,
  PaymentBreakdown,
  cashApi,
} from "@/lib/api/cash-api";
import { PaymentMethod } from "@/types/pdv";
import { useBranch } from "@/contexts/BranchContext";

// ── Formatters ────────────────────────────────────────────────────────────────

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

// ── Payment config ────────────────────────────────────────────────────────────

const PAYMENT_META: Record<PaymentMethod, { icon: React.ElementType; label: string; iconCls: string; barCls: string }> = {
  PIX:         { icon: QrCode,     label: "PIX",     iconCls: "bg-teal-50 text-teal-600",     barCls: "bg-teal-500" },
  CASH:        { icon: Banknote,   label: "Dinheiro", iconCls: "bg-emerald-50 text-emerald-600", barCls: "bg-emerald-500" },
  DEBIT_CARD:  { icon: CreditCard, label: "Débito",  iconCls: "bg-blue-50 text-blue-600",     barCls: "bg-blue-500" },
  CREDIT_CARD: { icon: CreditCard, label: "Crédito", iconCls: "bg-violet-50 text-violet-600", barCls: "bg-violet-500" },
  COURTESY:    { icon: Gift,       label: "Cortesia", iconCls: "bg-pink-50 text-pink-600",     barCls: "bg-pink-400" },
  PENDING:     { icon: Clock,      label: "Pendente", iconCls: "bg-amber-50 text-amber-600",   barCls: "bg-amber-400" },
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
    <div className="flex h-full flex-col bg-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-4 py-3 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-black tracking-tight text-brand-charcoal sm:text-lg">
              Caixa do dia
              {currentBranch && (
                <span className="ml-2 rounded-md bg-brand-charcoal px-2 py-0.5 text-[11px] font-black text-white">
                  {currentBranch.code} · {currentBranch.name}
                </span>
              )}
            </h1>
            <div className="flex items-center gap-2">
              {lastUpdate && (
                <p className="text-[11px] font-medium text-zinc-400">
                  Atualizado às {lastUpdate}
                </p>
              )}
              {isLive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-600">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  ao vivo
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data?.role === "ADMIN" && (
              <Link href="/app/caixa/relatorio">
                <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-charcoal px-3 text-xs font-black text-white transition-all hover:bg-brand-charcoal/90 active:scale-[0.97] sm:px-4">
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Relatório</span>
                </span>
              </Link>
            )}
            <button
              onClick={() => loadCash(true)}
              disabled={isLoading || isRefreshing}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-600 transition-all hover:bg-zinc-50 active:scale-[0.97] disabled:opacity-50 sm:px-4"
            >
              {isRefreshing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-4 px-4 pb-28 pt-5 md:px-6 md:pt-6">
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
    <div className="relative overflow-hidden rounded-2xl bg-brand-charcoal px-6 py-7 shadow-lg md:px-8 md:py-8">
      {/* Background glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-brand-red/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-0 h-40 w-40 rounded-full bg-white/5 blur-2xl" />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        {/* Main number */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            Recebido hoje
          </p>
          <p className="mt-1.5 text-4xl font-black tracking-tight text-white md:text-5xl">
            {currency.format(summary.totalRecebido)}
          </p>
          <p className="mt-2 text-sm font-medium text-zinc-400">
            {summary.totalPedidos} pedidos · {paidPct}% pagos
            {summary.peakHour && (
              <> · Pico <span className="text-zinc-300">{String(summary.peakHour.start).padStart(2, "0")}h</span></>
            )}
          </p>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-3 gap-2 sm:min-w-[260px]">
          <HeroMini label="Bruto" value={currency.format(summary.totalBruto)} />
          <HeroMini
            label="Pendente"
            value={currency.format(summary.totalPendente)}
            highlight={summary.pedidosPendentes > 0}
          />
          <HeroMini label="Ticket" value={currency.format(summary.ticketMedio)} />
        </div>
      </div>

      {/* Paid progress bar */}
      <div className="relative mt-6">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-white/50 transition-all duration-700"
            style={{ width: `${paidPct}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] font-medium text-zinc-500">
          <span>{summary.pedidosPagos} pagos</span>
          <span>{summary.totalPedidos} total</span>
        </div>
      </div>
    </div>
  );
}

function HeroMini({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-white/8 p-2.5 ring-1 ring-white/10">
      <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-0.5 truncate text-xs font-black ${highlight ? "text-amber-300" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

// ── Status strip ──────────────────────────────────────────────────────────────

function StatusStrip({ data }: { data: CaixaData }) {
  const { summary } = data;
  const chips = [
    { label: "Pagos",       count: summary.pedidosPagos,       cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
    { label: "Pendentes",   count: summary.pedidosPendentes,   cls: summary.pedidosPendentes > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-zinc-50 text-zinc-400 border-zinc-100", dot: summary.pedidosPendentes > 0 ? "bg-amber-400" : "bg-zinc-300" },
    { label: "Cancelados",  count: summary.pedidosCancelados,  cls: summary.pedidosCancelados > 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-zinc-50 text-zinc-400 border-zinc-100", dot: summary.pedidosCancelados > 0 ? "bg-red-500" : "bg-zinc-300" },
    { label: "Cortesias",   count: summary.pedidosCortesia,    cls: summary.pedidosCortesia > 0 ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-zinc-50 text-zinc-400 border-zinc-100", dot: summary.pedidosCortesia > 0 ? "bg-violet-500" : "bg-zinc-300" },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 hide-scrollbar">
      {chips.map((chip) => (
        <div
          key={chip.label}
          className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold ${chip.cls}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
          {chip.label}
          <span className="font-black">{chip.count}</span>
        </div>
      ))}
    </div>
  );
}

// ── Insights ──────────────────────────────────────────────────────────────────

const INSIGHT_STYLE: Record<InsightSeverity, { wrap: string; icon: string }> = {
  positive: { wrap: "border-emerald-100 bg-emerald-50",  icon: "text-emerald-600" },
  info:     { wrap: "border-blue-100 bg-blue-50",        icon: "text-blue-600" },
  warning:  { wrap: "border-amber-100 bg-amber-50",      icon: "text-amber-600" },
};

function InsightsSection({ insights }: { insights: DayInsight[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 px-0.5">
        <Info className="h-3.5 w-3.5 text-zinc-400" />
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Insights do dia</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((insight, i) => {
          const style = INSIGHT_STYLE[insight.severity];
          const Icon = insight.icon;
          return (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-2xl border p-4 ${style.wrap}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.icon}`} />
              <p className="text-sm font-medium leading-snug text-zinc-700">{insight.text}</p>
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

  if (summary.totalPedidos === 0) {
    return (
      <Card className="border-zinc-100 shadow-sm">
        <CardContent className="px-4 py-5">
          <p className="text-sm font-medium text-zinc-500">Sem vendas registradas ainda.</p>
        </CardContent>
      </Card>
    );
  }

  const peakLabel = summary.peakHour
    ? `${String(summary.peakHour.start).padStart(2, "0")}h–${String((summary.peakHour.start + 1) % 24).padStart(2, "0")}h · ${summary.peakHour.orderCount} pedido${summary.peakHour.orderCount !== 1 ? "s" : ""}`
    : "—";

  const avgLabel = summary.avgDeliveryMinutes != null
    ? `${summary.avgDeliveryMinutes} min`
    : "—";

  const topThree = topProducts.slice(0, 3);

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5 px-0.5">
        <BarChart3 className="h-3.5 w-3.5 text-zinc-400" />
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Hoje em números</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={ShoppingBag}
          label="Crepes vendidos"
          value={String(summary.crepesSold)}
        />
        <MetricCard
          icon={Zap}
          label="Horário de pico"
          value={peakLabel}
        />
        <MetricCard
          icon={Clock}
          label="Tempo médio de entrega"
          value={avgLabel}
        />
        <MetricCard
          icon={Trophy}
          label="Top 3 crepes do dia"
          empty={topThree.length === 0}
        >
          {topThree.length === 0 ? (
            <p className="mt-1 text-sm font-medium text-zinc-400">—</p>
          ) : (
            <ol className="mt-1 space-y-0.5">
              {topThree.map((p, i) => (
                <li key={p.name} className="truncate text-sm font-semibold text-brand-charcoal">
                  {i + 1}. {p.name} · <span className="font-bold text-zinc-500">{p.quantity} un</span>
                </li>
              ))}
            </ol>
          )}
        </MetricCard>
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  children,
  empty,
}: {
  icon: React.ElementType;
  label: string;
  value?: string;
  children?: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <Card className="border-zinc-100 shadow-sm">
      <CardContent className="px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-zinc-400" />
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">{label}</p>
        </div>
        {children ?? (
          <p className={`mt-1 text-xl font-black ${empty ? "text-zinc-400" : "text-brand-charcoal"}`}>
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Payments ──────────────────────────────────────────────────────────────────

function PaymentsCard({ items, received }: { items: PaymentBreakdown[]; received: number }) {
  const active = items.filter((i) => i.count > 0 && i.method !== "PENDING" && i.method !== "COURTESY");
  const pending = items.find((i) => i.method === "PENDING" && i.count > 0);

  if (active.length === 0 && !pending) return null;

  return (
    <Card className="overflow-hidden border-zinc-100 shadow-sm">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3.5">
        <Wallet className="h-4 w-4 text-brand-charcoal" />
        <h2 className="text-sm font-black text-brand-charcoal">Formas de pagamento</h2>
      </div>
      <CardContent className="divide-y divide-zinc-50 p-0">
        {active.map((item) => {
          const meta = PAYMENT_META[item.method];
          const Icon = meta.icon;
          const pct = received > 0 ? Math.round((item.total / received) * 100) : 0;
          return (
            <div key={item.method} className="px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className={`shrink-0 rounded-xl p-2 ${meta.iconCls}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-bold text-brand-charcoal">{meta.label}</p>
                    <p className="shrink-0 text-sm font-black text-brand-charcoal">{currency.format(item.total)}</p>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={`h-full rounded-full ${meta.barCls} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[11px] font-bold text-zinc-400">{pct}%</span>
                  </div>
                </div>
              </div>
              <p className="mt-0.5 pl-11 text-[11px] font-medium text-zinc-400">{item.count} pedido{item.count !== 1 ? "s" : ""}</p>
            </div>
          );
        })}

        {/* Pending row */}
        {pending && (
          <div className="flex items-center justify-between gap-3 bg-amber-50/60 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className="shrink-0 rounded-xl bg-amber-50 p-2 text-amber-600">
                <Clock className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold text-amber-800">Pendente</p>
                <p className="text-[11px] font-medium text-amber-600">{pending.count} pedido{pending.count !== 1 ? "s" : ""} aguardando</p>
              </div>
            </div>
            <p className="text-sm font-black text-amber-700">{currency.format(pending.total)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Admin CTA ─────────────────────────────────────────────────────────────────

function AdminCTA() {
  return (
    <Link
      href="/app/caixa/relatorio"
      className="group flex items-center justify-between gap-4 rounded-2xl border border-brand-charcoal bg-brand-charcoal px-5 py-4 shadow-sm transition-all hover:bg-brand-charcoal/90 hover:shadow-md active:scale-[0.98]"
    >
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-white/15 p-2.5">
          <BarChart3 className="h-4 w-4 text-white" />
        </span>
        <div>
          <p className="text-sm font-black text-white">Relatório gerencial</p>
          <p className="text-xs font-medium text-zinc-400">Análise completa de vendas e operação</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}
