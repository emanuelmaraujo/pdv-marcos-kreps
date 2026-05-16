'use client';

import { useState } from 'react';
import { Order, OrderItem, OrderItemStatus } from '@/types/pdv';
import { pdvApi } from '@/lib/api/pdv-api';
import { Clock, ChefHat, CheckCircle2, Package, X, Loader2, Wallet } from 'lucide-react';

const STATUS_META: Record<OrderItemStatus, { label: string; dot: string; pill: string; text: string }> = {
  PENDING:        { label: 'Pendente',    dot: 'bg-zinc-300',     pill: 'bg-zinc-100 text-zinc-600',   text: 'text-zinc-600' },
  IN_PREPARATION: { label: 'Em preparo',  dot: 'bg-amber-400',    pill: 'bg-amber-50 text-amber-700',  text: 'text-amber-700' },
  READY:          { label: 'Pronto',      dot: 'bg-emerald-500',  pill: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-700' },
  DELIVERED:      { label: 'Entregue',    dot: 'bg-emerald-700',  pill: 'bg-emerald-100 text-emerald-800', text: 'text-emerald-800' },
  CANCELLED:      { label: 'Cancelado',   dot: 'bg-zinc-200',     pill: 'bg-zinc-100 text-zinc-400',   text: 'text-zinc-400 line-through' },
};

const NEXT_QUICK: Record<OrderItemStatus, OrderItemStatus | null> = {
  PENDING:        'READY',
  IN_PREPARATION: 'READY',
  READY:          'DELIVERED',
  DELIVERED:      null,
  CANCELLED:      null,
};

const NEXT_LABEL: Record<OrderItemStatus, string> = {
  PENDING:        'Marcar pronto',
  IN_PREPARATION: 'Marcar pronto',
  READY:          'Entregar',
  DELIVERED:      '',
  CANCELLED:      '',
};

function itemLabel(order: Order, item: OrderItem): string {
  const code = order.branch?.code ?? '';
  const num = String(order.daily_number).padStart(3, '0');
  const seq = item.sequence_no ?? '?';
  return code ? `${code}-${num}-${seq}` : `${num}-${seq}`;
}

export function OrderItemsControl({
  order,
  onMutated,
}: {
  order: Order;
  onMutated?: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = order.items ?? [];
  if (items.length === 0) return null;

  const readyItems = items.filter((i) => i.status === 'READY');
  const canDeliverReady = readyItems.length > 0;

  const handleAdvance = async (item: OrderItem) => {
    const target = NEXT_QUICK[item.status];
    if (!target) return;
    setBusyId(item.id);
    setError(null);
    try {
      await pdvApi.updateOrderItemStatus({ orderItemId: item.id, newStatus: target });
      onMutated?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar item.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelItem = async (item: OrderItem) => {
    const reason = window.prompt('Motivo do cancelamento deste item:')?.trim();
    if (!reason) return;
    setBusyId(item.id);
    setError(null);
    try {
      await pdvApi.updateOrderItemStatus({
        orderItemId: item.id, newStatus: 'CANCELLED', reason,
      });
      onMutated?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao cancelar item.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeliverAllReady = async () => {
    setError(null);
    for (const item of readyItems) {
      setBusyId(item.id);
      try {
        await pdvApi.updateOrderItemStatus({ orderItemId: item.id, newStatus: 'DELIVERED' });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erro ao entregar item.');
      }
    }
    setBusyId(null);
    onMutated?.();
  };

  return (
    <div className="space-y-3">
      {canDeliverReady && (
        <button
          type="button"
          onClick={handleDeliverAllReady}
          disabled={busyId !== null}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-sm transition-all hover:bg-amber-600 active:scale-95 disabled:opacity-60"
        >
          {busyId !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
          Entregar prontos ({readyItems.length})
        </button>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {error}
        </div>
      )}

      <ul className="space-y-2">
        {items.map((item) => {
          const meta = STATUS_META[item.status];
          const next = NEXT_QUICK[item.status];
          const isBusy = busyId === item.id;

          return (
            <li
              key={item.id}
              className="rounded-xl border border-zinc-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                    <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] font-black text-white">
                      {itemLabel(order, item)}
                    </span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${meta.pill}`}>
                      {meta.label}
                    </span>
                    {item.payment_status === 'PAID' && (
                      <span className="flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                        <Wallet className="h-2.5 w-2.5" /> Pago
                      </span>
                    )}
                  </div>
                  <p className={`mt-1 truncate text-sm font-bold ${meta.text}`}>
                    {item.quantity}× {item.product_name_snapshot}
                  </p>
                  {item.observation && (
                    <p className="mt-0.5 text-[11px] italic text-zinc-500">&ldquo;{item.observation}&rdquo;</p>
                  )}
                </div>

                {next && (
                  <button
                    type="button"
                    onClick={() => handleAdvance(item)}
                    disabled={isBusy}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-charcoal px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white transition-all hover:bg-zinc-700 active:scale-95 disabled:opacity-60"
                  >
                    {isBusy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : next === 'READY' ? (
                      <ChefHat className="h-3 w-3" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    {NEXT_LABEL[item.status]}
                  </button>
                )}
              </div>

              {item.status !== 'DELIVERED' && item.status !== 'CANCELLED' && (
                <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-100 pt-2 text-[10px] font-bold text-zinc-400">
                  {item.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => pdvApi.updateOrderItemStatus({ orderItemId: item.id, newStatus: 'IN_PREPARATION' }).then(() => onMutated?.())}
                      className="flex items-center gap-1 rounded px-2 py-1 hover:bg-zinc-50"
                    >
                      <Clock className="h-2.5 w-2.5" /> Iniciar preparo
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCancelItem(item)}
                    disabled={isBusy}
                    className="flex items-center gap-1 rounded px-2 py-1 text-red-500 hover:bg-red-50"
                  >
                    <X className="h-2.5 w-2.5" /> Cancelar item
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
