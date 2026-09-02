"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Clock,
  Loader2,
  Minus,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { CashReportResponse, reportsApi } from "@/lib/api/reports-api";
import { getBusinessDayRange } from "@/lib/utils/business-day";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateLabelFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  weekday: "short",
});

type CompareMode = "previous" | "sameWeekday" | "custom";

interface CompareRange {
  label: string;
  start: Date;
  end: Date;
}

interface KpiRow {
  key: string;
  label: string;
  curr: number;
  compare: number;          // valor de referência (média ou anterior)
  format: "currency" | "number" | "int";
  invertDelta?: boolean;    // métricas onde menor é melhor
}

interface SectionCompareProps {
  /** Range atual escolhido pelo usuário no painel principal. */
  currentRange: { start: Date; end: Date; label: string };
  /** Se o range atual cobre exatamente 1 dia comercial. Habilita "mesmo dia da semana". */
  isSingleDay: boolean;
  /** Filial atual (passada às chamadas do report). */
  branchId: string | null;
  /** Mantém comparação coerente com o filtro principal do relatório. */
  orderType?: "ALL" | "BALCAO" | "VIAGEM" | "ENTREGA";
  weekday?: "ALL" | "Domingo" | "Segunda" | "Terça" | "Quarta" | "Quinta" | "Sexta" | "Sábado";
}

/**
 * Aba "Comparar".
 *
 * Modos:
 *  - previous       : período × período imediatamente anterior (mesma duração)
 *  - sameWeekday    : dia × média das últimas 4 ocorrências do mesmo dia da semana
 *
 * Toggle "Até a mesma hora" só aparece quando current range termina no futuro
 * (ex: hoje em curso) — capa o end das duas pontas no horário SP atual para
 * não comparar "8h de hoje" com "dia inteiro de ontem".
 */
export function SectionCompare({ currentRange, isSingleDay, branchId, orderType = "ALL", weekday = "ALL" }: SectionCompareProps) {
  const [mode, setMode] = useState<CompareMode>("previous");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [sameHourCap, setSameHourCap] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [currReport, setCurrReport] = useState<CashReportResponse | null>(null);
  const [compareReport, setCompareReport] = useState<CashReportResponse | null>(null);

  const customRange = useMemo<CompareRange | null>(() => {
    if (!customStart || !customEnd) return null;
    return buildCustomCompareRange(customStart, customEnd);
  }, [customStart, customEnd]);

  // Se modo "mesmo dia da semana" só faz sentido para 1 dia, força fallback.
  // O modo custom só passa a consultar quando as duas pontas foram escolhidas.
  const effectiveMode: CompareMode = mode === "custom" && customRange
    ? "custom"
    : isSingleDay && mode === "sameWeekday"
    ? "sameWeekday"
    : "previous";

  const compareRange = useMemo<CompareRange>(() => {
    return effectiveMode === "custom" && customRange
      ? customRange
      : buildCompareRange(currentRange, effectiveMode);
  }, [currentRange, effectiveMode, customRange]);

  // "Até a mesma hora": cap end nos dois ranges no momento atual (SP).
  // Só faz sentido se end > now.
  //
  // `now` só precisa ser recalculado quando o range ou o toggle "mesma hora"
  // mudam de verdade — não a cada render (ex: isLoading alternando). Se
  // fosse `new Date()` direto no corpo do componente, cappedCurrent/cappedCompare
  // (que alimentam o useCallback `load` abaixo, disparado por um useEffect)
  // ganhariam uma referência nova a cada render e o effect entraria em loop
  // de fetch — por isso `now` fica memoizado, não recalculado sempre.
  // Deps abaixo são a chave de invalidação intencional (recalcula "now"
  // quando o range ou o toggle mudam), não valores lidos dentro do callback.
  const comparisonClockKey = `${currentRange.start.getTime()}-${currentRange.end.getTime()}-${sameHourCap}-${effectiveMode}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [comparisonClockKey]);
  const isOngoing = currentRange.end.getTime() > now.getTime();
  const showHourCap = isOngoing;
  const applyHourCap = showHourCap && sameHourCap;

  const cappedCurrent = useMemo(() => {
    if (!applyHourCap) return currentRange;
    return { ...currentRange, end: clampEnd(currentRange.end, now) };
  }, [applyHourCap, currentRange, now]);

  const cappedCompare = useMemo(() => {
    if (!applyHourCap || effectiveMode === "custom") return compareRange;
    // Cap end do range de comparação na mesma "duração relativa" do atual.
    const elapsedMs = now.getTime() - currentRange.start.getTime();
    const cappedEnd = new Date(compareRange.start.getTime() + elapsedMs);
    return { ...compareRange, end: cappedEnd };
  }, [applyHourCap, compareRange, currentRange, now, effectiveMode]);

  const load = useCallback(async () => {
    if (mode === "custom" && !customRange) {
      setError("Selecione o início e o fim do período de comparação.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const baseFilter = {
        category_id: "ALL",
        payment_method: "ALL",
        ...(branchId ? { branch_id: branchId } : {}),
        ...(orderType !== "ALL" ? { order_type: orderType } : {}),
        ...(weekday !== "ALL" ? { weekday } : {}),
      };
      const [curr, cmp] = await Promise.all([
        reportsApi.getCashReport({
          ...baseFilter,
          start_date: cappedCurrent.start.toISOString(),
          end_date: cappedCurrent.end.toISOString(),
        }),
        effectiveMode === "sameWeekday"
          ? loadSameWeekdayAverage(cappedCurrent, branchId, orderType, weekday)
          : reportsApi.getCashReport({
              ...baseFilter,
              start_date: cappedCompare.start.toISOString(),
              end_date: cappedCompare.end.toISOString(),
            }),
      ]);
      setCurrReport(curr);
      setCompareReport(cmp);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Não conseguimos carregar a comparação."));
    } finally {
      setIsLoading(false);
    }
  }, [cappedCurrent, cappedCompare, effectiveMode, branchId, orderType, weekday, mode, customRange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const kpis: KpiRow[] = useMemo(() => {
    if (!currReport || !compareReport) return [];
    return [
      { key: "received",     label: "Recebido",        curr: currReport.summary.received,         compare: compareReport.summary.received,         format: "currency" },
      { key: "margin",       label: "Margem bruta",    curr: currReport.summary.gross_margin,     compare: compareReport.summary.gross_margin,     format: "currency" },
      { key: "marginPct",    label: "Margem %",        curr: currReport.summary.gross_margin_percent, compare: compareReport.summary.gross_margin_percent, format: "number" },
      { key: "orders",       label: "Pedidos pagos",   curr: currReport.summary.paid_orders,      compare: compareReport.summary.paid_orders,      format: "int" },
      { key: "total",        label: "Pedidos totais",  curr: currReport.summary.total_orders,     compare: compareReport.summary.total_orders,     format: "int" },
      { key: "ticket",       label: "Ticket médio",    curr: currReport.summary.average_ticket,   compare: compareReport.summary.average_ticket,   format: "currency" },
      { key: "pending",      label: "Pendente",        curr: currReport.summary.pending,          compare: compareReport.summary.pending,          format: "currency", invertDelta: true },
      { key: "courtesy",     label: "Cortesia (custo)",curr: currReport.summary.courtesy,         compare: compareReport.summary.courtesy,         format: "currency", invertDelta: true },
      { key: "canceled",     label: "Cancelado",       curr: currReport.summary.canceled,         compare: compareReport.summary.canceled,         format: "currency", invertDelta: true },
      { key: "discounts",    label: "Descontos",       curr: currReport.summary.discounts,        compare: compareReport.summary.discounts,        format: "currency", invertDelta: true },
    ];
  }, [currReport, compareReport]);

  return (
    <div className="space-y-5">
      {/* Controles */}
      <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-full bg-[var(--bg-subtle)] p-1">
              <ModeButton
                active={effectiveMode === "previous"}
                onClick={() => setMode("previous")}
                icon={CalendarDays}
                label="Período anterior"
              />
              <ModeButton
                active={effectiveMode === "sameWeekday"}
                onClick={() => isSingleDay && setMode("sameWeekday")}
                icon={TrendingUp}
                label="Mesmo dia da semana"
                disabled={!isSingleDay}
                hint={!isSingleDay ? "Escolha um único dia no painel para usar este modo" : undefined}
              />
              <ModeButton
                active={mode === "custom"}
                onClick={() => setMode("custom")}
                icon={CalendarDays}
                label="Outro período"
              />
            </div>
            {showHourCap && (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={sameHourCap}
                  onChange={(e) => setSameHourCap(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                <Clock className="h-3 w-3" strokeWidth={1.75} />
                Até a mesma hora
              </label>
            )}
            <button
              onClick={load}
              disabled={isLoading}
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-40"
            >
              {isLoading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />}
              Atualizar
            </button>
          </div>

          {mode === "custom" && (
            <div className="mt-4 rounded-2xl border border-brand-red/20 bg-brand-red/[0.04] p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-1.5">
                <div>
                  <p className="text-xs font-black text-[var(--text-primary)]">Período B — referência</p>
                  <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">Escolha o intervalo que será comparado ao período selecionado no topo.</p>
                </div>
                <span className="rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-[10px] font-bold text-[var(--text-secondary)]">Período A: {cappedCurrent.label}</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Início do período B</span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCustomStart(value);
                      if (customEnd && value > customEnd) setCustomEnd(value);
                    }}
                    className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm font-semibold text-[var(--text-primary)] outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/10"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Fim do período B</span>
                  <input
                    type="date"
                    min={customStart || undefined}
                    value={customEnd}
                    onChange={(event) => setCustomEnd(event.target.value)}
                    className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm font-semibold text-[var(--text-primary)] outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/10"
                  />
                </label>
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] font-medium text-[var(--text-muted)] sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-wide">Atual</p>
              <p className="mt-0.5 text-xs font-bold text-[var(--text-primary)]">{cappedCurrent.label}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-wide">
                {effectiveMode === "sameWeekday" ? "Média das últimas 4 ocorrências" : effectiveMode === "custom" ? "Período B" : "Período anterior"}
              </p>
              <p className="mt-0.5 text-xs font-bold text-[var(--text-primary)]">{compareRange.label}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 text-sm font-medium text-red-600">{error}</CardContent>
        </Card>
      ) : isLoading && !currReport ? (
        <Card className="border-[var(--border)]">
          <CardContent className="p-6 text-center text-sm font-medium text-[var(--text-muted)]">
            Carregando comparação...
          </CardContent>
        </Card>
      ) : kpis.length > 0 ? (
        <Card className="border-[var(--border)] shadow-[var(--shadow-sm)]">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">Indicador</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">Atual</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                      {effectiveMode === "sameWeekday" ? "Média" : effectiveMode === "custom" ? "Período B" : "Anterior"}
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">Δ abs</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">Δ %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {kpis.map((row) => (
                    <KpiTableRow key={row.key} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ModeButton({ active, onClick, icon: Icon, label, disabled, hint }: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {label}
    </button>
  );
}

function KpiTableRow({ row }: { row: KpiRow }) {
  const abs = row.curr - row.compare;
  const pct = row.compare !== 0 ? (abs / row.compare) * 100 : null;
  const isImproving = (row.invertDelta ? abs < 0 : abs > 0);
  const isWorse = (row.invertDelta ? abs > 0 : abs < 0);
  const cls = abs === 0
    ? "text-[var(--text-muted)]"
    : isImproving
    ? "text-emerald-600"
    : isWorse
    ? "text-red-600"
    : "text-[var(--text-muted)]";

  const Icon = abs === 0 ? Minus : abs > 0 ? ArrowUp : ArrowDown;

  return (
    <tr>
      <td className="px-4 py-3 font-bold text-[var(--text-primary)]">{row.label}</td>
      <td className="px-4 py-3 text-right font-black text-[var(--text-primary)] tabular-nums">
        {formatValue(row.curr, row.format)}
      </td>
      <td className="px-4 py-3 text-right font-medium text-[var(--text-secondary)] tabular-nums">
        {formatValue(row.compare, row.format)}
      </td>
      <td className={`px-4 py-3 text-right font-black tabular-nums ${cls}`}>
        {abs !== 0 && (
          <span className="inline-flex items-center gap-0.5">
            <Icon className="h-3 w-3" strokeWidth={2.25} />
            {formatValue(Math.abs(abs), row.format)}
          </span>
        )}
        {abs === 0 && <Minus className="ml-auto h-3 w-3" />}
      </td>
      <td className={`px-4 py-3 text-right font-black tabular-nums ${cls}`}>
        {pct === null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`}
      </td>
    </tr>
  );
}

function formatValue(v: number, fmt: KpiRow["format"]): string {
  if (fmt === "currency") return currency.format(v);
  if (fmt === "int") return Math.round(v).toString();
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function clampEnd(end: Date, now: Date) {
  return now.getTime() < end.getTime() ? now : end;
}

/**
 * Range de comparação derivado do range atual.
 *   previous     : mesma duração imediatamente antes
 *   sameWeekday  : 7 dias antes (rótulo destaca que é "média de 4 semanas")
 */
function buildCompareRange(curr: { start: Date; end: Date; label: string }, mode: CompareMode): CompareRange {
  const ms = curr.end.getTime() - curr.start.getTime();
  if (mode === "sameWeekday") {
    const start = new Date(curr.start.getTime() - 7 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + ms);
    return {
      start, end,
      label: `4 semanas anteriores (mesmo dia da semana)`,
    };
  }
  // previous
  const end = new Date(curr.start.getTime());
  const start = new Date(end.getTime() - ms);
  return {
    start, end,
    label: `${dateLabelFmt.format(start)} → ${dateLabelFmt.format(new Date(end.getTime() - 1))}`,
  };
}

function buildCustomCompareRange(startKey: string, endKey: string): CompareRange {
  // Meio-dia local evita que o parser de YYYY-MM-DD retroceda um dia por fuso.
  const startDay = getBusinessDayRange(new Date(`${startKey}T12:00:00`));
  const endDay = getBusinessDayRange(new Date(`${endKey}T12:00:00`));
  return {
    start: startDay.start,
    end: endDay.end,
    label: `${dateLabelFmt.format(startDay.start)} → ${dateLabelFmt.format(new Date(endDay.end.getTime() - 1))}`,
  };
}

/**
 * Carrega 4 últimas ocorrências do mesmo dia da semana e devolve um
 * CashReportResponse "médio" (somente summary é usado pelos KPIs).
 */
async function loadSameWeekdayAverage(
  curr: { start: Date; end: Date },
  branchId: string | null,
  orderType: "ALL" | "BALCAO" | "VIAGEM" | "ENTREGA",
  weekday: "ALL" | "Domingo" | "Segunda" | "Terça" | "Quarta" | "Quinta" | "Sexta" | "Sábado",
): Promise<CashReportResponse> {
  const ms = curr.end.getTime() - curr.start.getTime();
  const baseFilter = {
    category_id: "ALL",
    payment_method: "ALL",
    ...(branchId ? { branch_id: branchId } : {}),
    ...(orderType !== "ALL" ? { order_type: orderType } : {}),
    ...(weekday !== "ALL" ? { weekday } : {}),
  };

  const ranges = Array.from({ length: 4 }, (_, i) => {
    const offsetDays = (i + 1) * 7;
    // Re-deriva business-day para garantir limites corretos
    const ref = new Date(curr.start.getTime() - offsetDays * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
    const bd = getBusinessDayRange(ref);
    // Aplica mesma duração relativa do range atual (importante para "até a mesma hora")
    const end = new Date(bd.start.getTime() + ms);
    return { start: bd.start, end };
  });

  const reports = await Promise.all(
    ranges.map((r) =>
      reportsApi.getCashReport({
        ...baseFilter,
        start_date: r.start.toISOString(),
        end_date: r.end.toISOString(),
      }).catch(() => null),
    ),
  );

  const valid = reports.filter((r): r is CashReportResponse => r !== null);
  const n = valid.length || 1;

  const avg = (key: keyof CashReportResponse["summary"]) =>
    valid.reduce((s, r) => s + (r.summary[key] as number), 0) / n;

  // Constrói um CashReportResponse "esqueleto" — só summary é consumido aqui
  return {
    summary: {
      received: avg("received"),
      pending: avg("pending"),
      courtesy: avg("courtesy"),
      canceled: avg("canceled"),
      gross_sales: avg("gross_sales"),
      discounts: avg("discounts"),
      total_orders: avg("total_orders"),
      paid_orders: avg("paid_orders"),
      average_ticket: avg("average_ticket"),
      cogs: avg("cogs"),
      gross_margin: avg("gross_margin"),
      gross_margin_percent: avg("gross_margin_percent"),
      delivery_fees: avg("delivery_fees"),
      courier_reserve: avg("courier_reserve"),
      store_received: avg("store_received"),
    },
    payment_breakdown: [],
    category_breakdown: [],
    top_all_products: [],
    category_rankings: { savory_kreps: [], sweet_kreps: [], juices: [], sodas: [], potatoes: [], creams: [], others: [] },
    hourly_sales: [],
    weekday_sales: [],
    heatmap: [],
    low_selling_products: [],
    order_type_breakdown: [],
    delivery_operation: {
      total_orders: 0, awaiting_dispatch: 0, on_route: 0, delivered: 0,
      ready_to_dispatch: { count: 0, median: 0, p90: 0, max: 0, queue_loss_min: 0 },
      dispatch_to_delivered: { count: 0, median: 0, p90: 0, max: 0, queue_loss_min: 0 },
    },
    financial_attention: {
      discount_orders: 0, discount_total: avg("discounts"),
      courtesy_orders: 0, courtesy_total: avg("courtesy"),
      canceled_orders: 0, canceled_total: avg("canceled"),
    },
    pipeline_stages: {
      acceptance: { count: 0, median: 0, p90: 0, max: 0, queue_loss_min: 0 },
      delivery:   { count: 0, median: 0, p90: 0, max: 0, queue_loss_min: 0 },
      payment:    { count: 0, median: 0, p90: 0, max: 0, queue_loss_min: 0 },
    },
    insights: [],
    metadata: { is_filtered_by_category: false, note: null },
  };
}
