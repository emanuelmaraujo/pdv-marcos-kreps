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
  XCircle,
  Zap,
} from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Card, CardContent } from "@/components/ui/Card";
import {
  CaixaData,
  PaymentBreakdown,
  PendingOrder,
  TopProduct,
  cashApi,
} from "@/lib/api/cash-api";
import { PaymentMethod } from "@/types/pdv";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

const PAYMENT_META: Record<PaymentMethod, { icon: React.ElementType; color: string; bar: string }> = {
  PIX:         { icon: QrCode,     color: "text-teal-600 bg-teal-50 ring-teal-200",    bar: "bg-teal-500" },
  CASH:        { icon: Banknote,   color: "text-emerald-600 bg-emerald-50 ring-emerald-200", bar: "bg-emerald-500" },
  DEBIT_CARD:  { icon: CreditCard, color: "text-blue-600 bg-blue-50 ring-blue-200",    bar: "bg-blue-500" },
  CREDIT_CARD: { icon: CreditCard, color: "text-violet-600 bg-violet-50 ring-violet-200", bar: "bg-violet-500" },
  COURTESY:    { icon: Gift,       color: "text-pink-600 bg-pink-50 ring-pink-200",    bar: "bg-pink-400" },
  PENDING:     { icon: Clock,      color: "text-amber-600 bg-amber-50 ring-amber-200", bar: "bg-amber-400" },
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
      setData(await cashApi.getDaySummary());
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
        const next = await cashApi.getDaySummary();
        if (!cancelled) setData(next);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar caixa");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const lastUpdate = data?.generatedAt ? timeFormatter.format(new Date(data.generatedAt)) : null;
  const isEmpty = data?.summary.totalPedidos === 0;

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      {/* ── Top bar ── */}
      <header className="border-b border-zinc-200 bg-white px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-black tracking-tight text-brand-charcoal sm:text-lg">
              Caixa do dia
            </h1>
            {lastUpdate && (
              <p className="text-[11px] font-medium text-zinc-400">Atualizado às {lastUpdate}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {data?.role === "ADMIN" && (
              <Link href="/app/caixa/relatorio">
                <button className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-charcoal px-3 text-xs font-black text-white shadow-sm transition-all hover:bg-brand-charcoal/90 active:scale-[0.97] sm:px-4 sm:text-sm">
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Relatório</span>
                </button>
              </Link>
            )}
            <button
              onClick={() => loadCash(true)}
              disabled={isLoading || isRefreshing}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-600 shadow-sm transition-all hover:bg-zinc-50 active:scale-[0.97] disabled:opacity-50 sm:px-4 sm:text-sm"
            >
              {isRefreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 pb-28 pt-5 md:px-8 md:pt-7">
          {isLoading && !data ? (
            <LoadingState message="Carregando resumo do dia..." />
          ) : error ? (
            <ErrorState
              title="Não foi possível carregar o caixa"
              message={error}
              onRetry={() => loadCash(false)}
            />
          ) : !data ? null : isEmpty ? (
            <EmptyState
              title="Sem vendas hoje"
              description="Os pedidos do dia aparecerão aqui assim que forem criados."
            />
          ) : (
            <div className="space-y-5">
              {/* Hero + KPIs side-by-side on xl */}
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
                <CashHero data={data} />
                <KpiStack data={data} />
              </div>

              {/* Pending alert */}
              {data.pendingOrders.length > 0 && (
                <PendingOrdersSection orders={data.pendingOrders} />
              )}

              {/* Main content grid */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
                <div className="space-y-5">
                  <TopProductsSection products={data.topProducts.slice(0, 5)} />
                </div>
                <div className="space-y-5">
                  <PaymentBreakdownSection items={data.paymentBreakdown} received={data.summary.totalRecebido} />
                  <FinancialAttentionSection data={data} />
                </div>
              </div>

              {/* Quick navigation */}
              <QuickLinks role={data.role} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function CashHero({ data }: { data: CaixaData }) {
  const { summary } = data;
  const paidRate = summary.totalPedidos > 0
    ? Math.round((summary.pedidosPagos / summary.totalPedidos) * 100)
    : 0;
  const peakLabel = summary.horaDePico != null
    ? `${String(summary.horaDePico).padStart(2, "0")}h–${String(summary.horaDePico + 1).padStart(2, "0")}h`
    : null;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-brand-charcoal shadow-xl">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-red/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/5 blur-2xl" />

      <div className="relative p-6 md:p-8">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              Movimento de hoje
            </p>
            <p className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">
              {currency.format(summary.totalRecebido)}
            </p>
          </div>
          {/* Paid rate ring */}
          <div className="flex shrink-0 flex-col items-center gap-1">
            <PaidRateRing rate={paidRate} />
            <p className="text-[10px] font-bold text-zinc-400">{paidRate}% pagos</p>
          </div>
        </div>

        {/* Mini stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HeroStat label="Bruto" value={currency.format(summary.totalBruto)} />
          <HeroStat label="Pendente" value={currency.format(summary.totalPendente)} warn={summary.pedidosPendentes > 0} />
          <HeroStat label="Ticket médio" value={currency.format(summary.ticketMedio)} />
          <HeroStat
            label="Hora de pico"
            value={peakLabel ?? "—"}
            icon={peakLabel ? Zap : undefined}
          />
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white/60 transition-all duration-700"
              style={{ width: `${paidRate}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] font-medium text-zinc-500">
            <span>{summary.pedidosPagos} pagos</span>
            <span>{summary.totalPedidos} total</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaidRateRing({ rate }: { rate: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;

  return (
    <svg width="60" height="60" viewBox="0 0 60 60" className="-rotate-90">
      <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
      <circle
        cx="30" cy="30" r={r} fill="none"
        stroke="rgba(255,255,255,0.7)" strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.7s ease" }}
      />
    </svg>
  );
}

function HeroStat({
  label,
  value,
  warn,
  icon: Icon,
}: {
  label: string;
  value: string;
  warn?: boolean;
  icon?: React.ElementType;
}) {
  return (
    <div className="rounded-2xl bg-white/8 p-3 backdrop-blur-sm ring-1 ring-white/10">
      <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3 shrink-0 text-amber-400" />}
        <p className={`truncate text-sm font-black ${warn ? "text-amber-300" : "text-white"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ── KPI Stack ────────────────────────────────────────────────────────────────

function KpiStack({ data }: { data: CaixaData }) {
  const { summary } = data;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-1 xl:gap-3">
      <KpiCard
        icon={ShoppingBag}
        label="Pedidos"
        primary={String(summary.totalPedidos)}
        secondary={`${summary.pedidosPagos} pagos · ${summary.pedidosPendentes} pendentes`}
        tone="zinc"
      />
      <KpiCard
        icon={TrendingUp}
        label="Recebido"
        primary={currency.format(summary.totalRecebido)}
        secondary={`Ticket médio ${currency.format(summary.ticketMedio)}`}
        tone="emerald"
      />
      <KpiCard
        icon={XCircle}
        label="Cancelamentos"
        primary={String(summary.pedidosCancelados)}
        secondary={`${summary.taxaCancelamento.toFixed(1)}% dos pedidos`}
        tone={summary.pedidosCancelados > 0 ? "red" : "zinc"}
      />
      <KpiCard
        icon={Gift}
        label="Cortesias"
        primary={String(summary.pedidosCortesia)}
        secondary={summary.pedidosCortesia > 0 ? currency.format(summary.totalCortesia) : "Nenhuma hoje"}
        tone={summary.pedidosCortesia > 0 ? "violet" : "zinc"}
      />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  primary,
  secondary,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  primary: string;
  secondary: string;
  tone: "zinc" | "emerald" | "red" | "violet" | "amber";
}) {
  const tones = {
    zinc:    { wrap: "bg-white border-zinc-100", icon: "bg-zinc-100 text-zinc-600" },
    emerald: { wrap: "bg-white border-emerald-100", icon: "bg-emerald-50 text-emerald-600" },
    red:     { wrap: "bg-white border-red-100",    icon: "bg-red-50 text-red-600" },
    violet:  { wrap: "bg-white border-violet-100", icon: "bg-violet-50 text-violet-600" },
    amber:   { wrap: "bg-white border-amber-100",  icon: "bg-amber-50 text-amber-600" },
  };
  const t = tones[tone];
  return (
    <Card className={`border shadow-sm ${t.wrap}`}>
      <CardContent className="flex items-start gap-4 p-4">
        <span className={`mt-0.5 shrink-0 rounded-xl p-2.5 ${t.icon}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">{label}</p>
          <p className="mt-0.5 truncate text-xl font-black leading-tight text-brand-charcoal">{primary}</p>
          <p className="mt-0.5 truncate text-xs font-medium text-zinc-400">{secondary}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Pending orders ────────────────────────────────────────────────────────────

function PendingOrdersSection({ orders }: { orders: PendingOrder[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-amber-200 bg-amber-50 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-amber-200 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-white">
            {orders.length}
          </span>
          <h2 className="text-sm font-black text-amber-900">Pedidos pendentes</h2>
        </div>
        <Link
          href="/app/pedidos"
          className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900"
        >
          Ver todos <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-px bg-amber-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {orders.slice(0, 8).map((order) => (
          <div key={order.id} className="flex items-center justify-between gap-3 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-black text-brand-charcoal">
                #{String(order.daily_number).padStart(3, "0")}
              </p>
              <p className="text-xs font-medium text-zinc-400">
                {timeFormatter.format(new Date(order.created_at))}
              </p>
            </div>
            <p className="text-sm font-black text-amber-600">{currency.format(order.total_amount)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top products ──────────────────────────────────────────────────────────────

function TopProductsSection({ products }: { products: TopProduct[] }) {
  if (products.length === 0) return null;
  const maxQty = Math.max(...products.map((p) => p.quantity), 1);

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-zinc-100 px-5 py-4">
        <Trophy className="h-4 w-4 text-brand-amber" />
        <h2 className="text-sm font-black text-brand-charcoal">Mais vendidos hoje</h2>
      </div>
      <div className="divide-y divide-zinc-50">
        {products.map((product, index) => {
          const pct = (product.quantity / maxQty) * 100;
          return (
            <div key={product.name} className="flex items-center gap-4 px-5 py-4">
              {/* Rank */}
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${
                  index === 0
                    ? "bg-brand-amber text-white shadow-sm"
                    : index === 1
                    ? "bg-zinc-300 text-brand-charcoal"
                    : index === 2
                    ? "bg-amber-700/20 text-amber-800"
                    : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {index + 1}
              </span>

              {/* Name + bar */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-bold text-brand-charcoal">{product.name}</p>
                  <p className="shrink-0 text-sm font-black text-brand-charcoal">
                    {currency.format(product.revenue)}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-brand-red"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs font-bold text-zinc-400">
                    {product.quantity} un.
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Payment breakdown ─────────────────────────────────────────────────────────

function PaymentBreakdownSection({
  items,
  received,
}: {
  items: PaymentBreakdown[];
  received: number;
}) {
  const active = items.filter((i) => i.count > 0 && i.method !== "PENDING" && i.method !== "COURTESY");
  if (active.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-zinc-100 px-5 py-4">
        <Wallet className="h-4 w-4 text-brand-charcoal" />
        <h2 className="text-sm font-black text-brand-charcoal">Meios de pagamento</h2>
      </div>
      <div className="divide-y divide-zinc-50">
        {active.map((item) => {
          const meta = PAYMENT_META[item.method] ?? { icon: Wallet, color: "text-zinc-600 bg-zinc-100 ring-zinc-200", bar: "bg-zinc-400" };
          const Icon = meta.icon;
          const pct = received > 0 ? Math.round((item.total / received) * 100) : 0;
          return (
            <div key={item.method} className="px-5 py-4">
              <div className="flex items-center gap-3">
                <span className={`shrink-0 rounded-xl p-2 ring-1 ${meta.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-bold text-brand-charcoal">{item.label}</p>
                    <p className="shrink-0 text-sm font-black text-brand-charcoal">
                      {currency.format(item.total)}
                    </p>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={`h-full rounded-full ${meta.bar} transition-all duration-500`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs font-bold text-zinc-400">
                      {pct}%
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-1 pl-11 text-xs font-medium text-zinc-400">{item.count} pedidos</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Financial attention ───────────────────────────────────────────────────────

function FinancialAttentionSection({ data }: { data: CaixaData }) {
  const { summary } = data;
  if (summary.totalDescontos === 0 && summary.totalCortesia === 0 && summary.totalCancelado === 0) {
    return null;
  }
  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-4">
        <h2 className="text-sm font-black text-brand-charcoal">Ajustes financeiros</h2>
      </div>
      <div className="divide-y divide-zinc-50">
        {summary.totalDescontos > 0 && (
          <FinancialRow
            label="Descontos"
            value={currency.format(summary.totalDescontos)}
            count={summary.pedidosComDesconto}
            tone="red"
          />
        )}
        {summary.totalCortesia > 0 && (
          <FinancialRow
            label="Cortesias"
            value={currency.format(summary.totalCortesia)}
            count={summary.pedidosCortesia}
            tone="violet"
          />
        )}
        {summary.totalCancelado > 0 && (
          <FinancialRow
            label="Cancelados"
            value={currency.format(summary.totalCancelado)}
            count={summary.pedidosCancelados}
            tone="zinc"
          />
        )}
      </div>
    </div>
  );
}

function FinancialRow({
  label,
  value,
  count,
  tone,
}: {
  label: string;
  value: string;
  count: number;
  tone: "red" | "violet" | "zinc";
}) {
  const tones = {
    red:    "text-red-600",
    violet: "text-violet-600",
    zinc:   "text-zinc-500",
  };
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5">
      <div>
        <p className="text-sm font-bold text-brand-charcoal">{label}</p>
        <p className="text-xs font-medium text-zinc-400">{count} registro{count !== 1 ? "s" : ""}</p>
      </div>
      <p className={`text-sm font-black ${tones[tone]}`}>{value}</p>
    </div>
  );
}

// ── Quick links ───────────────────────────────────────────────────────────────

function QuickLinks({ role }: { role: CaixaData["role"] }) {
  return (
    <div className={`grid gap-3 ${role === "ADMIN" ? "sm:grid-cols-2" : "grid-cols-1"}`}>
      <Link
        href="/app/pedidos"
        className="group flex items-center justify-between gap-3 rounded-3xl border border-zinc-200 bg-white px-5 py-4 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md active:scale-[0.98]"
      >
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-zinc-100 p-2.5 text-brand-charcoal transition-colors group-hover:bg-zinc-200">
            <ShoppingBag className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-black text-brand-charcoal">Pedidos de hoje</p>
            <p className="text-xs font-medium text-zinc-400">Ver e gerenciar pedidos</p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-1" />
      </Link>

      {role === "ADMIN" && (
        <Link
          href="/app/caixa/relatorio"
          className="group flex items-center justify-between gap-3 rounded-3xl border border-brand-charcoal bg-brand-charcoal px-5 py-4 shadow-sm transition-all hover:bg-brand-charcoal/90 hover:shadow-md active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-white/15 p-2.5 text-white">
              <BarChart3 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-black text-white">Relatório gerencial</p>
              <p className="text-xs font-medium text-zinc-400">Análise completa do período</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}
