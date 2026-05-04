"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  CreditCard,
  Gift,
  Loader2,
  Package,
  Percent,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  CaixaData,
  PaymentBreakdown,
  PendingOrder,
  StatusBreakdown,
  TopProduct,
  cashApi,
} from "@/lib/api/cash-api";
import { OrderStatus } from "@/types/pdv";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

export default function CaixaPage() {
  const [data, setData] = useState<CaixaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadCash = useCallback(async (refreshing = false) => {
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError("");

    try {
      const nextData = await cashApi.getDaySummary();
      setData(nextData);
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
        const nextData = await cashApi.getDaySummary();
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar caixa");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const lastUpdate = data?.generatedAt
    ? timeFormatter.format(new Date(data.generatedAt))
    : null;

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <PageHeader
        title="Caixa"
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadCash(true)}
            disabled={isLoading || isRefreshing}
            className="gap-2 bg-white"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Atualizar
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {isLoading && !data ? (
          <LoadingState message="Carregando resumo do dia..." />
        ) : error ? (
          <ErrorState
            title="Não foi possível carregar o caixa"
            message={error}
            onRetry={() => loadCash(false)}
          />
        ) : !data ? null : data.summary.totalPedidos === 0 ? (
          <div className="space-y-4">
            <EmptyState
              title="Sem vendas hoje"
              description="Os pedidos do dia aparecerão aqui assim que forem criados."
            />
            <CashNote role={data.role} lastUpdate={lastUpdate} />
          </div>
        ) : (
          <div className="space-y-4">
            <CashNote role={data.role} lastUpdate={lastUpdate} />

            <section className="grid grid-cols-2 gap-3">
              <SummaryCard
                title="Total bruto"
                value={currency.format(data.summary.totalBruto)}
                description="Não cancelados"
                icon={ReceiptText}
                accent="text-slate-900"
                className="col-span-2"
              />
              <SummaryCard
                title="Recebido"
                value={currency.format(data.summary.totalRecebido)}
                description="Pedidos pagos"
                icon={Wallet}
                accent="text-emerald-700"
              />
              <SummaryCard
                title="Pendente"
                value={currency.format(data.summary.totalPendente)}
                description={`${data.summary.pedidosPendentes} pedidos`}
                icon={Clock}
                accent="text-amber-700"
              />
              <SummaryCard
                title="Pedidos"
                value={String(data.summary.totalPedidos)}
                description={`${data.summary.pedidosPagos} pagos`}
                icon={ShoppingBag}
                accent="text-slate-900"
              />
              <SummaryCard
                title="Ticket médio"
                value={currency.format(data.summary.ticketMedio)}
                description="Recebido / pagos"
                icon={CreditCard}
                accent="text-slate-900"
              />
              <SummaryCard
                title="Embalagem"
                value={currency.format(data.summary.totalEmbalagem)}
                description="Taxas do dia"
                icon={Package}
                accent="text-orange-700"
              />
              <SummaryCard
                title="Cancelados"
                value={String(data.summary.pedidosCancelados)}
                description={currency.format(data.summary.totalCancelado)}
                icon={AlertTriangle}
                accent="text-red-700"
              />
            </section>

            <PendingOrdersCard orders={data.pendingOrders} />

            <section className="grid grid-cols-2 gap-3">
              <SummaryCard
                title="Descontos"
                value={currency.format(data.summary.totalDescontos)}
                description={`${data.summary.pedidosComDesconto} pedidos`}
                icon={Percent}
                accent="text-red-700"
              />
              <SummaryCard
                title="Cortesias"
                value={currency.format(data.summary.totalCortesia)}
                description={`${data.summary.pedidosCortesia} pedidos`}
                icon={Gift}
                accent="text-violet-700"
              />
            </section>

            <PaymentBreakdownCard items={data.paymentBreakdown} />
            <StatusBreakdownCard items={data.statusBreakdown} />
            <TopProductsCard products={data.topProducts} />
          </div>
        )}
      </div>
    </div>
  );
}

function CashNote({ role, lastUpdate }: { role: CaixaData["role"]; lastUpdate: string | null }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
      <p className="font-semibold">Resumo financeiro do dia</p>
      <p>
        Fonte principal: pedidos de hoje em <span className="font-semibold">orders</span>.
        {role === "ATTENDANT"
          ? " Seu perfil pode ver apenas o que a RLS permitir."
          : " Valores respeitam a RLS do usuário logado."}
      </p>
      {lastUpdate && <p className="mt-1 text-amber-800">Atualizado às {lastUpdate}.</p>}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  accent,
  className = "",
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  className?: string;
}) {
  return (
    <Card className={`rounded-xl border-slate-200 bg-white shadow-sm ${className}`}>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </span>
          <span className="rounded-lg bg-orange-50 p-2 text-orange-600">
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className={`text-2xl font-black leading-tight ${accent}`}>{value}</p>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </CardContent>
    </Card>
  );
}

function PaymentBreakdownCard({ items }: { items: PaymentBreakdown[] }) {
  return (
    <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Vendas por pagamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {items.map((item) => (
          <BreakdownRow
            key={item.method}
            label={item.label}
            count={item.count}
            value={currency.format(item.total)}
            tone={item.method === "PENDING" ? "warning" : item.method === "COURTESY" ? "soft" : "normal"}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function StatusBreakdownCard({ items }: { items: StatusBreakdown[] }) {
  return (
    <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Status dos pedidos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 p-4 pt-0">
        {items.map((item) => (
          <div key={item.status} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase leading-snug text-slate-500">
              {item.label}
            </p>
            <p className="mt-1 text-2xl font-black text-slate-900">{item.count}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PendingOrdersCard({ orders }: { orders: PendingOrder[] }) {
  return (
    <Card className="rounded-xl border-amber-200 bg-amber-50 shadow-sm">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base text-amber-950">Pedidos pendentes</CardTitle>
          <Badge variant={orders.length > 0 ? "destructive" : "outline"}>
            {orders.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {orders.length === 0 ? (
          <p className="rounded-lg bg-white/70 p-3 text-sm font-medium text-amber-900">
            Nenhum pedido com pagamento pendente.
          </p>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    Pedido #{order.daily_number}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {statusLabel(order.status)} · {timeFormatter.format(new Date(order.created_at))}
                  </p>
                </div>
                <p className="text-base font-black text-amber-700">
                  {currency.format(order.total_amount)}
                </p>
              </div>
              <Link
                href="/app/pedidos"
                className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md border border-amber-300 bg-amber-100 text-sm font-bold text-amber-950 transition-colors hover:bg-amber-200"
              >
                Ver em Pedidos
              </Link>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function TopProductsCard({ products }: { products: TopProduct[] }) {
  return (
    <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Produtos mais vendidos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {products.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
            Sem itens vendidos em pedidos não cancelados.
          </p>
        ) : (
          products.map((product, index) => (
            <div key={product.name} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-700">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{product.name}</p>
                  <p className="text-xs text-slate-500">{product.quantity} unidades</p>
                </div>
              </div>
              <p className="shrink-0 text-sm font-black text-slate-900">
                {currency.format(product.revenue)}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownRow({
  label,
  count,
  value,
  tone,
}: {
  label: string;
  count: number;
  value: string;
  tone: "normal" | "warning" | "soft";
}) {
  const toneClass =
    tone === "warning"
      ? "bg-amber-50 text-amber-800"
      : tone === "soft"
        ? "bg-violet-50 text-violet-800"
        : "bg-slate-50 text-slate-700";

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white py-2">
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{count} pedidos</p>
      </div>
      <span className={`rounded-lg px-3 py-2 text-sm font-black ${toneClass}`}>{value}</span>
    </div>
  );
}

function statusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    AGUARDANDO_CONFIRMACAO: "Aguardando confirmação",
    AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
    NA_FILA: "Na fila",
    PRONTO: "Pronto",
    ENTREGUE: "Entregue",
    CANCELADO: "Cancelado",
    EXPIRADO: "Expirado",
  };

  return labels[status] ?? status;
}
