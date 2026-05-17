"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, CreditCard, Flame, Loader2, PackageCheck, QrCode, RefreshCw, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { pdvApi, PublicOrderStatusResponse } from "@/lib/api/pdv-api";
import { OrderStatus } from "@/types/pdv";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_COPY: Record<OrderStatus, { title: string; description: string; tone: string }> = {
  AGUARDANDO_PAGAMENTO: {
    title: "Aguardando pagamento",
    description: "Finalize o pagamento para a equipe receber o pedido.",
    tone: "bg-amber-50 text-amber-800 border-amber-100",
  },
  AGUARDANDO_CONFIRMACAO: {
    title: "Pedido em conferencia",
    description: "A equipe esta validando seu pedido antes de mandar para preparo.",
    tone: "bg-blue-50 text-blue-700 border-blue-100",
  },
  NA_FILA: {
    title: "Na fila de preparo",
    description: "Seu pedido ja entrou no fluxo da cozinha.",
    tone: "bg-red-50 text-brand-red border-red-100",
  },
  PRONTO_PARCIAL: {
    title: "Parte do pedido ja esta pronto",
    description: "Voce pode comecar a retirar os itens prontos no balcao. O restante ainda esta sendo preparado.",
    tone: "bg-amber-50 text-amber-800 border-amber-200",
  },
  PRONTO: {
    title: "Pronto para retirada",
    description: "Pode se aproximar do balcao. Seu pedido esta esperando por voce.",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  ENTREGUE: {
    title: "Pedido entregue",
    description: "Obrigado por pedir no Marcos Krep's.",
    tone: "bg-zinc-100 text-zinc-600 border-zinc-200",
  },
  CANCELADO: {
    title: "Pedido cancelado",
    description: "Este pedido foi cancelado pela equipe.",
    tone: "bg-red-50 text-red-700 border-red-100",
  },
  EXPIRADO: {
    title: "Pedido expirado",
    description: "O prazo para pagamento ou confirmacao expirou.",
    tone: "bg-zinc-100 text-zinc-600 border-zinc-200",
  },
};

const FLOW: Array<{ key: string; label: string; statuses: OrderStatus[] }> = [
  { key: "payment", label: "Pagamento", statuses: ["AGUARDANDO_PAGAMENTO"] },
  { key: "confirm", label: "Confirmacao", statuses: ["AGUARDANDO_CONFIRMACAO"] },
  { key: "queue", label: "Preparo", statuses: ["NA_FILA", "PRONTO_PARCIAL"] },
  { key: "ready", label: "Pronto", statuses: ["PRONTO"] },
  { key: "done", label: "Entregue", statuses: ["ENTREGUE"] },
];

function getFlowIndex(status: OrderStatus) {
  if (status === "AGUARDANDO_PAGAMENTO") return 0;
  if (status === "AGUARDANDO_CONFIRMACAO") return 1;
  if (status === "NA_FILA" || status === "PRONTO_PARCIAL") return 2;
  if (status === "PRONTO") return 3;
  if (status === "ENTREGUE") return 4;
  return -1;
}

function formatDateTime(value?: string) {
  if (!value) return "--";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isLikelyPublicToken(value: string) {
  return /^[a-f0-9]{32}$/i.test(value);
}

export function PedidoStatusClient({ publicToken }: { publicToken: string }) {
  const [statusData, setStatusData] = useState<PublicOrderStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const canFetch = isLikelyPublicToken(publicToken);

  const fetchStatus = useCallback(async (showLoading = false) => {
    if (!canFetch) {
      setIsLoading(false);
      setError("Link de acompanhamento invalido.");
      return;
    }
    if (showLoading) setIsRefreshing(true);
    setError("");
    try {
      const response = await pdvApi.getPublicOrderStatus({
        public_token: publicToken,
      });
      setStatusData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar o pedido.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [canFetch, publicToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => fetchStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchStatus]);

  useEffect(() => {
    const status = statusData?.order.status;
    if (!status || ["ENTREGUE", "CANCELADO", "EXPIRADO"].includes(status)) return;
    const interval = window.setInterval(() => fetchStatus(false), 7000);
    return () => window.clearInterval(interval);
  }, [fetchStatus, statusData?.order.status]);

  const order = statusData?.order;
  const activeIndex = useMemo(() => (order ? getFlowIndex(order.status) : -1), [order]);
  const copy = order ? STATUS_COPY[order.status] : null;
  const displayNumber = order ? String(order.daily_number).padStart(3, "0") : "---";

  return (
    <div className="min-h-screen bg-[#FFF7ED] pb-10 text-zinc-950">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(135deg,rgba(255,247,237,0.98),rgba(255,255,255,0.94)_45%,rgba(254,243,199,0.7))]" />
      <header className="sticky top-0 z-30 border-b border-amber-900/10 bg-[#fffaf2]/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red text-white">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-black">Marcos Krep&apos;s</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700/70">Acompanhar pedido</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => fetchStatus(true)}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:px-6">
        <section className="space-y-5">
          <div className="rounded-2xl border border-amber-900/10 bg-[#2A1612] p-5 text-white shadow-sm md:p-6">
            <p className="text-xs font-black uppercase tracking-widest text-amber-200">Pedido</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-5xl font-black leading-none">#{displayNumber}</h1>
                {order?.customer_name && <p className="mt-2 text-sm font-bold text-amber-100">Retirada de {order.customer_name}</p>}
              </div>
              {copy && (
                <div className={`rounded-2xl border px-4 py-3 ${copy.tone}`}>
                  <p className="text-sm font-black">{copy.title}</p>
                </div>
              )}
            </div>
            {copy ? (
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-relaxed text-amber-100/85">{copy.description}</p>
            ) : (
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-relaxed text-amber-100/85">
                O numero do pedido aparece aqui somente depois que o link privado e validado.
              </p>
            )}
          </div>

          {isLoading ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-amber-900/10 bg-white">
              <Loader2 className="h-8 w-8 animate-spin text-brand-red" />
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Buscando pedido</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-red-700">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-bold">{error}</p>
                  <p className="mt-1 text-xs font-semibold text-red-600/80">
                    Confira se voce abriu o link privado gerado no checkout.
                  </p>
                </div>
              </div>
            </div>
          ) : order ? (
            <>
              <section className="rounded-2xl border border-amber-900/10 bg-white/95 p-4 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">Andamento</h2>
                <div className="mt-5 space-y-3 md:grid md:grid-cols-5 md:gap-3 md:space-y-0">
                  {FLOW.map((step, index) => {
                    const done = activeIndex >= index;
                    const current = step.statuses.includes(order.status);
                    return (
                      <div
                        key={step.key}
                        className={`rounded-2xl border p-3 transition-all ${
                          current
                            ? "border-brand-red bg-red-50 text-brand-red shadow-sm"
                            : done
                              ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                              : "border-zinc-200 bg-zinc-50 text-zinc-400"
                        }`}
                      >
                        <div className="flex items-center gap-2 md:flex-col md:items-start">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${done ? "bg-white" : "bg-zinc-100"}`}>
                            {done ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                          </div>
                          <p className="text-xs font-black uppercase tracking-wide">{step.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {statusData.items && statusData.items.length > 0 && (
                <section className="rounded-2xl border border-amber-900/10 bg-white/95 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">Seus itens</h2>
                    {statusData.items.length > 1 && (() => {
                      const active = statusData.items!.filter((i) => i.status !== "CANCELLED");
                      const done = active.filter((i) => i.status === "READY" || i.status === "DELIVERED");
                      return (
                        <span className="text-xs font-black text-zinc-500">
                          {done.length}/{active.length} prontos
                        </span>
                      );
                    })()}
                  </div>
                  <div className="space-y-2">
                    {statusData.items.map((item) => {
                      const itemStatus = item.status;
                      const seqNo = item.sequence_no;
                      const branch = (statusData.order as { branch?: { code?: string } | null }).branch;
                      const orderNum = String(order!.daily_number).padStart(3, "0");
                      const label = seqNo != null
                        ? (branch?.code ? `${branch.code}-${orderNum}-${seqNo}` : `${orderNum}-${seqNo}`)
                        : null;

                      const statusMeta = {
                        PENDING:        { label: "Em preparo",    bg: "bg-zinc-100",     text: "text-zinc-500",     dot: "bg-zinc-400" },
                        IN_PREPARATION: { label: "Em preparo",    bg: "bg-amber-50",     text: "text-amber-700",    dot: "bg-amber-400" },
                        READY:          { label: "✓ Pronto!",     bg: "bg-emerald-50",   text: "text-emerald-700",  dot: "bg-emerald-500" },
                        DELIVERED:      { label: "Entregue",      bg: "bg-zinc-100",     text: "text-zinc-400",     dot: "bg-zinc-300" },
                        CANCELLED:      { label: "Cancelado",     bg: "bg-zinc-50",      text: "text-zinc-400",     dot: "bg-zinc-300" },
                      }[itemStatus ?? "PENDING"] ?? { label: "Em preparo", bg: "bg-zinc-100", text: "text-zinc-500", dot: "bg-zinc-400" };

                      const isReady    = itemStatus === "READY";
                      const isCancelled = itemStatus === "CANCELLED";

                      return (
                        <div
                          key={item.sequence_no ?? item.product_name}
                          className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${
                            isReady ? "border-emerald-200 bg-emerald-50"
                            : isCancelled ? "border-zinc-100 bg-zinc-50 opacity-50"
                            : "border-zinc-100 bg-zinc-50"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {label && (
                                <span className="shrink-0 rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] font-black text-white">
                                  {label}
                                </span>
                              )}
                              <span className={`shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${statusMeta.bg} ${statusMeta.text}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                                {statusMeta.label}
                              </span>
                            </div>
                            <p className={`mt-1 text-sm font-black ${isCancelled ? "line-through text-zinc-400" : "text-zinc-900"}`}>
                              {item.quantity}× {item.product_name}
                            </p>
                            {item.addons.length > 0 && (
                              <p className="mt-0.5 text-xs font-bold text-emerald-600">
                                + {item.addons.map((a) => `${a.quantity}x ${a.name}`).join(", ")}
                              </p>
                            )}
                            {item.removed_ingredients.length > 0 && (
                              <p className="mt-0.5 text-xs font-bold text-brand-red">Sem {item.removed_ingredients.join(", ")}</p>
                            )}
                            {item.observation && <p className="mt-0.5 text-xs italic text-zinc-400">&ldquo;{item.observation}&rdquo;</p>}
                          </div>
                          <p className={`shrink-0 text-sm font-black ${isCancelled ? "text-zinc-400 line-through" : "text-zinc-700"}`}>
                            {currency.format(item.total_price)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          ) : null}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-amber-900/10 bg-white/95 p-4 shadow-sm lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">Detalhes</h2>
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
                Ao vivo
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3">
                <span className="flex items-center gap-2 text-sm font-bold text-zinc-500"><CreditCard className="h-4 w-4" /> Pagamento</span>
                <span className="text-sm font-black text-zinc-900">{order?.payment_status ?? "--"}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3">
                <span className="flex items-center gap-2 text-sm font-bold text-zinc-500"><ShoppingBag className="h-4 w-4" /> Total</span>
                <span className="text-lg font-black text-brand-red">{order ? currency.format(order.total) : "--"}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3">
                <span className="flex items-center gap-2 text-sm font-bold text-zinc-500"><Clock className="h-4 w-4" /> Criado</span>
                <span className="text-sm font-black text-zinc-900">{formatDateTime(order?.created_at)}</span>
              </div>
              {statusData?.transaction?.expires_at && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-amber-800">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    <p className="text-sm font-black">Pix aguardando</p>
                  </div>
                  <p className="mt-1 text-xs font-bold">Expira {formatDateTime(statusData.transaction.expires_at)}</p>
                </div>
              )}
              {order?.status === "PRONTO_PARCIAL" && (
                <div className="rounded-2xl bg-amber-500 p-4 text-white">
                  <PackageCheck className="h-6 w-6" />
                  <p className="mt-2 text-base font-black">Parte do pedido pronta!</p>
                  <p className="text-sm font-semibold text-amber-50">
                    Voce pode comecar a retirar os itens prontos no balcao. Os demais estao saindo.
                  </p>
                </div>
              )}
              {order?.status === "PRONTO" && (
                <div className="rounded-2xl bg-emerald-500 p-4 text-white">
                  <PackageCheck className="h-6 w-6" />
                  <p className="mt-2 text-lg font-black">Seu pedido esta pronto!</p>
                  <p className="text-sm font-semibold text-emerald-50">Mostre esta tela no balcao para retirar.</p>
                </div>
              )}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
