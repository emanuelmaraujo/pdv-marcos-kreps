"use client";

/**
 * Tela "Acompanhar pedido" — última do fluxo público.
 * Único objetivo: eliminar a ansiedade do cliente.
 *
 * Render é dirigido por um mapa de configuração STATE_CONFIG[status],
 * evitando ifs espalhados pela árvore. Mudar visual de um estado =
 * editar uma entrada.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  ChefHat,
  Check,
  CircleCheck,
  Clock,
  CreditCard,
  Flame,
  MessageCircle,
  Plus,
  RefreshCw,
  Star,
  type LucideIcon,
} from "lucide-react";
import { pdvApi, PublicOrderStatusResponse } from "@/lib/api/pdv-api";
import { OrderStatus } from "@/types/pdv";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// ── Configuração declarativa por estado ──────────────────────────────────────

type StateKey = "AWAITING_PAYMENT" | "CONFIRMED" | "IN_PREP" | "READY" | "DELIVERED" | "CANCELED";

type PillTone = "warning" | "neutral-translucent" | "brand" | "success" | "muted-translucent" | "danger";

interface StateConfig {
  pill: { label: string; tone: PillTone; pulsing: boolean };
  hint: string;
  activeStepIndex: number; // 0..4
}

// Mapeia status do backend → estado da UI
function statusToStateKey(status: OrderStatus): StateKey {
  switch (status) {
    case "AGUARDANDO_PAGAMENTO":
      return "AWAITING_PAYMENT";
    case "AGUARDANDO_CONFIRMACAO":
      return "CONFIRMED";
    case "NA_FILA":
    case "PRONTO_PARCIAL":
      return "IN_PREP";
    case "PRONTO":
      return "READY";
    case "ENTREGUE":
      return "DELIVERED";
    case "CANCELADO":
    case "EXPIRADO":
      return "CANCELED";
  }
}

const STATE_CONFIG: Record<StateKey, StateConfig> = {
  AWAITING_PAYMENT: {
    pill: { label: "Aguardando pagamento", tone: "warning", pulsing: true },
    hint: "Finalize o pagamento para a equipe começar o preparo.",
    activeStepIndex: 0,
  },
  CONFIRMED: {
    pill: { label: "Pedido confirmado", tone: "neutral-translucent", pulsing: false },
    hint: "Recebemos seu pedido. Em breve começaremos o preparo.",
    activeStepIndex: 1,
  },
  IN_PREP: {
    pill: { label: "Em preparo", tone: "brand", pulsing: true },
    hint: "Seu krep está sendo preparado com carinho.",
    activeStepIndex: 2,
  },
  READY: {
    pill: { label: "Pronto para retirada", tone: "success", pulsing: false },
    hint: "Retire seu pedido no balcão. Bom apetite!",
    activeStepIndex: 3,
  },
  DELIVERED: {
    pill: { label: "Entregue", tone: "muted-translucent", pulsing: false },
    hint: "Obrigado pela preferência. Volte sempre!",
    activeStepIndex: 4,
  },
  CANCELED: {
    pill: { label: "Pedido cancelado", tone: "danger", pulsing: false },
    hint: "Este pedido foi cancelado. Em caso de dúvidas, fale com a equipe.",
    activeStepIndex: -1,
  },
};

const STEPS: Array<{ icon: LucideIcon; label: string; subtitle: string }> = [
  { icon: CreditCard,  label: "Pagamento",   subtitle: "Aguardando confirmação" },
  { icon: CircleCheck, label: "Confirmação", subtitle: "Loja recebe seu pedido" },
  { icon: ChefHat,     label: "Em preparo",  subtitle: "Estão fazendo seu krep" },
  { icon: Bell,        label: "Pronto",      subtitle: "Pode retirar no balcão" },
  { icon: Check,       label: "Entregue",    subtitle: "Bom apetite!" },
];

// ── Helpers visuais para o pill ──────────────────────────────────────────────

function pillStyles(tone: PillTone): { bg: string; color: string; dotColor: string } {
  switch (tone) {
    case "warning":
      return { bg: "var(--accent)", color: "var(--bg-inverse)", dotColor: "var(--bg-inverse)" };
    case "neutral-translucent":
      return { bg: "rgba(255,255,255,0.15)", color: "#FFFFFF", dotColor: "#FFFFFF" };
    case "brand":
      return { bg: "var(--brand)", color: "#FFFFFF", dotColor: "#FFFFFF" };
    case "success":
      return { bg: "var(--status-success, #16A34A)", color: "#FFFFFF", dotColor: "#FFFFFF" };
    case "muted-translucent":
      return { bg: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.60)", dotColor: "rgba(255,255,255,0.60)" };
    case "danger":
      return { bg: "var(--status-danger, #DC2626)", color: "#FFFFFF", dotColor: "#FFFFFF" };
  }
}

// ── Helper para item status ──────────────────────────────────────────────────

type ItemStatusUI = "queue" | "in_prep" | "ready" | "delivered" | "canceled";

function itemStatusUI(status: string | null | undefined): ItemStatusUI {
  switch (status) {
    case "READY":          return "ready";
    case "DELIVERED":      return "delivered";
    case "CANCELLED":      return "canceled";
    case "IN_PREPARATION": return "in_prep";
    default:               return "queue";
  }
}

const ITEM_STATUS_LABELS: Record<ItemStatusUI, { label: string; color: string }> = {
  queue:     { label: "Na fila",    color: "var(--text-muted)" },
  in_prep:   { label: "Em preparo", color: "var(--status-warning, #D97706)" },
  ready:     { label: "Pronto",     color: "var(--status-success, #16A34A)" },
  delivered: { label: "Entregue",   color: "var(--text-muted)" },
  canceled:  { label: "Cancelado",  color: "var(--text-muted)" },
};

// ── Validador de token ──────────────────────────────────────────────────────

function isLikelyPublicToken(value: string) {
  return /^[a-f0-9]{32}$/i.test(value);
}

// ── Componente principal ────────────────────────────────────────────────────

export function PedidoStatusClient({ publicToken }: { publicToken: string }) {
  const [statusData, setStatusData] = useState<PublicOrderStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const canFetch = isLikelyPublicToken(publicToken);

  const fetchStatus = useCallback(async (showLoading = false) => {
    if (!canFetch) {
      setIsLoading(false);
      setError("Link de acompanhamento inválido.");
      return;
    }
    if (showLoading) setIsRefreshing(true);
    setError("");
    try {
      const response = await pdvApi.getPublicOrderStatus({ public_token: publicToken });
      setStatusData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o pedido.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [canFetch, publicToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => fetchStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchStatus]);

  // Polling automático a cada 30s — para nos estados terminais.
  useEffect(() => {
    const status = statusData?.order.status;
    if (!status || ["ENTREGUE", "CANCELADO", "EXPIRADO"].includes(status)) return;
    const interval = window.setInterval(() => fetchStatus(false), 30_000);
    return () => window.clearInterval(interval);
  }, [fetchStatus, statusData?.order.status]);

  const order = statusData?.order;
  const stateKey = useMemo(() => (order ? statusToStateKey(order.status) : null), [order]);
  const cfg = stateKey ? STATE_CONFIG[stateKey] : null;
  const displayNumber = order ? String(order.daily_number).padStart(3, "0") : "---";

  // Contagem de itens prontos / total (para "X de Y prontos")
  const itemsCounts = useMemo(() => {
    const list = statusData?.items ?? [];
    const active = list.filter((i) => i.status !== "CANCELLED");
    const ready = active.filter((i) => i.status === "READY" || i.status === "DELIVERED").length;
    return { ready, total: active.length };
  }, [statusData?.items]);

  const isAwaitingPayment = stateKey === "AWAITING_PAYMENT";
  const isInPrep = stateKey === "IN_PREP";
  const isDelivered = stateKey === "DELIVERED";

  return (
    <div className="min-h-screen pb-8" style={{ backgroundColor: "var(--bg-base)" }}>

      {/* ── 1. Header fixo (fundo escuro, transição natural para o hero) ── */}
      <header className="px-4 py-3" style={{ backgroundColor: "var(--bg-inverse)" }}>
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-red">
              <Flame className="h-4 w-4 text-white" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white leading-tight">Marcos Krep&apos;s</p>
              <p className="text-[11px] text-white/60 leading-tight">Pedido online</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchStatus(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-white hover:bg-white/15 disabled:opacity-50"
            style={{ backgroundColor: "rgba(255,255,255,0.10)" }}
            aria-label="Atualizar status"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              strokeWidth={1.75}
              style={{ transition: "transform 600ms ease" }}
            />
            Atualizar
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-3 px-4 pt-3 pb-6">

        {/* Loading inicial */}
        {isLoading && !statusData && (
          <div className="space-y-3 pt-4">
            <div className="skeleton h-44 w-full rounded-2xl" />
            <div className="skeleton h-72 w-full rounded-2xl" />
            <div className="skeleton h-32 w-full rounded-2xl" />
          </div>
        )}

        {/* Erro */}
        {!isLoading && error && (
          <div
            className="rounded-2xl p-4 flex items-start gap-3"
            style={{ backgroundColor: "var(--status-danger-bg, #FEF2F2)", color: "var(--status-danger, #DC2626)" }}
          >
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" strokeWidth={1.75} />
            <div>
              <p className="text-sm font-semibold">{error}</p>
              <p className="mt-1 text-xs opacity-80">Confira se você abriu o link gerado no checkout.</p>
            </div>
          </div>
        )}

        {/* Conteúdo principal */}
        {order && cfg && stateKey && (
          <>
            {/* ── 2. Hero card ─────────────────────────────────────── */}
            <section
              className="rounded-2xl p-5 text-white shadow-[var(--shadow-md)]"
              style={{ backgroundColor: "var(--bg-inverse)" }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/55">Seu pedido</p>
              <h1 className="mt-1 text-4xl font-bold leading-none tabular-nums text-white">#{displayNumber}</h1>
              {order.customer_name && (
                <p className="mt-2 text-[13px] text-white/60">
                  {order.customer_name}
                </p>
              )}

              {/* Status pill */}
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
                style={{ backgroundColor: pillStyles(cfg.pill.tone).bg, color: pillStyles(cfg.pill.tone).color }}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.pill.pulsing ? "animate-pulse-dot" : ""}`}
                  style={{ backgroundColor: pillStyles(cfg.pill.tone).dotColor }}
                  aria-hidden
                />
                <span className="text-[12px] font-semibold leading-none">{cfg.pill.label}</span>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-white/40 max-w-[28rem]">
                {cfg.hint}
              </p>
            </section>

            {/* ── 3. Andamento (timeline vertical) ─────────────────── */}
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-[11px] font-semibold text-[var(--text-muted)]">Andamento</h2>
                {cfg.activeStepIndex >= 0 && (
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Etapa {cfg.activeStepIndex + 1} de {STEPS.length}
                  </span>
                )}
              </div>

              <ol className="space-y-0">
                {STEPS.map((step, idx) => {
                  const isDone = cfg.activeStepIndex > idx;
                  const isActive = cfg.activeStepIndex === idx;
                  const isFuture = cfg.activeStepIndex < idx;
                  const isLast = idx === STEPS.length - 1;
                  const Icon = step.icon;

                  // Pulse só nos estados de ação pendente (awaiting payment + in prep)
                  const showPulse = isActive && (isAwaitingPayment || isInPrep);

                  return (
                    <li key={step.label} className="flex items-start gap-3">
                      {/* Ícone + conector vertical */}
                      <div className="flex flex-col items-center shrink-0">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                            isActive ? "border-2" : "border"
                          }`}
                          style={{
                            backgroundColor: isDone
                              ? "var(--brand)"
                              : isActive
                                ? "var(--brand-light)"
                                : "rgba(30,16,8,0.04)",
                            borderColor: isDone || isActive ? "var(--brand)" : "var(--border)",
                          }}
                        >
                          {isDone ? (
                            <Check className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                          ) : (
                            <Icon
                              className={`h-3.5 w-3.5 ${showPulse ? "animate-pulse-dot" : ""}`}
                              strokeWidth={1.75}
                              style={{ color: isActive ? "var(--brand)" : "var(--text-muted)" }}
                            />
                          )}
                        </div>
                        {!isLast && (
                          <div
                            className="w-px my-0.5"
                            style={{
                              height: 24,
                              backgroundColor: isDone ? "var(--brand)" : "rgba(30,16,8,0.10)",
                            }}
                            aria-hidden
                          />
                        )}
                      </div>

                      {/* Label + subtítulo */}
                      <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-3"}`}>
                        <p
                          className="text-[14px] font-semibold leading-tight"
                          style={{
                            color: isActive
                              ? "var(--brand)"
                              : isDone
                                ? "var(--text-primary)"
                                : "var(--text-muted)",
                          }}
                        >
                          {step.label}
                        </p>
                        {(isActive || isDone) && (
                          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                            {step.subtitle}
                          </p>
                        )}

                        {/* Estimativa de tempo — só quando step = "Em preparo" e ativo */}
                        {isActive && idx === 2 && (
                          <span
                            className="inline-flex items-center gap-1 mt-2 rounded-md px-2.5 py-1 text-[11px] font-medium"
                            style={{
                              backgroundColor: "var(--status-warning-bg, #FFFBEB)",
                              color: "var(--status-warning, #D97706)",
                            }}
                          >
                            <Clock className="h-3 w-3" strokeWidth={1.75} />
                            Pronto em aproximadamente 12 min
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            {/* ── 4. Itens ─────────────────────────────────────────── */}
            {statusData?.items && statusData.items.length > 0 && (
              <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-[11px] font-semibold text-[var(--text-muted)]">Seus itens</h2>
                  {itemsCounts.total > 1 && (
                    <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                      {itemsCounts.ready} de {itemsCounts.total} prontos
                    </span>
                  )}
                </div>

                <div className="divide-y divide-[var(--border)]">
                  {statusData.items.map((item, idx) => {
                    const ui = itemStatusUI(item.status);
                    const meta = ITEM_STATUS_LABELS[ui];
                    const seqNo = item.sequence_no;
                    const branch = (statusData.order as { branch?: { code?: string } | null }).branch;
                    const orderNum = String(order.daily_number).padStart(3, "0");
                    const codeLabel = seqNo != null
                      ? (branch?.code ? `${branch.code}-${orderNum}-${seqNo}` : `${orderNum}-${seqNo}`)
                      : null;
                    const isCanceled = ui === "canceled";

                    return (
                      <div key={`${item.product_name}-${idx}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                        {codeLabel && (
                          <span
                            className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white tabular-nums"
                            style={{ backgroundColor: "var(--bg-inverse)" }}
                          >
                            {codeLabel}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-medium ${isCanceled ? "line-through opacity-50" : "text-[var(--text-primary)]"}`}>
                            {item.quantity}× {item.product_name}
                          </p>
                          {item.addons.length > 0 && (
                            <p className="mt-0.5 text-[11px]" style={{ color: "var(--status-success, #16A34A)" }}>
                              + {item.addons.map((a) => `${a.quantity}× ${a.name}`).join(", ")}
                            </p>
                          )}
                          {item.removed_ingredients.length > 0 && (
                            <p className="mt-0.5 text-[11px] text-brand-red">
                              Sem {item.removed_ingredients.join(", ")}
                            </p>
                          )}
                          {item.observation && (
                            <p className="mt-0.5 text-[11px] italic text-[var(--text-muted)]">
                              &ldquo;{item.observation}&rdquo;
                            </p>
                          )}
                          <p className="mt-0.5 text-[11px] font-medium" style={{ color: meta.color }}>
                            {meta.label}
                          </p>
                        </div>
                        <p
                          className={`shrink-0 text-[13px] font-semibold tabular-nums ${isCanceled ? "line-through opacity-50" : "text-[var(--text-primary)]"}`}
                        >
                          {currency.format(item.total_price)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Total */}
                <div className="flex items-center justify-between border-t border-[var(--border)] pt-3 mt-1">
                  <span className="text-[13px] text-[var(--text-muted)]">Total</span>
                  <span className="text-[15px] font-bold tabular-nums" style={{ color: "var(--accent)" }}>
                    {currency.format(order.total)}
                  </span>
                </div>
              </section>
            )}

            {/* ── 5. Banner WhatsApp ───────────────────────────────── */}
            <div
              className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
              style={{ backgroundColor: "var(--status-success-bg, #F0FDF4)" }}
            >
              <MessageCircle
                className="h-4 w-4 shrink-0 mt-0.5"
                strokeWidth={1.75}
                style={{ color: "var(--status-success, #16A34A)" }}
              />
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--status-success-text, #166534)" }}>
                Você receberá uma mensagem no WhatsApp quando seu pedido estiver pronto.
              </p>
            </div>

            {/* ── 6. CTAs no rodapé ────────────────────────────────── */}
            <div className="space-y-2 pt-1">
              {isDelivered && (
                <button
                  type="button"
                  onClick={() => window.location.href = "/pedir"}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-white shadow-[var(--shadow-sm)] hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: "var(--brand)", height: 50 }}
                >
                  <Star className="h-4 w-4" strokeWidth={1.75} />
                  Avaliar pedido
                </button>
              )}
              <button
                type="button"
                onClick={() => window.location.href = "/pedir"}
                className={`w-full flex items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-white hover:opacity-90 active:scale-[0.98] ${
                  isDelivered ? "" : "shadow-[var(--shadow-sm)]"
                }`}
                style={{ backgroundColor: "var(--bg-inverse)", height: 50 }}
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                Fazer novo pedido
              </button>
            </div>
          </>
        )}
      </main>

      <style jsx>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        :global(.animate-pulse-dot) {
          animation: pulse-dot 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
