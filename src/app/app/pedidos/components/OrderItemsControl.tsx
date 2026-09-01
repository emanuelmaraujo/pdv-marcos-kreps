'use client';

import { useState } from 'react';
import { Order, OrderItem, OrderItemStatus } from '@/types/pdv';
import { pdvApi } from '@/lib/api/pdv-api';
import { getFriendlyErrorMessage } from '@/lib/errors/messages';
import { Clock, ChefHat, CheckCircle2, Package, X, Loader2, Wallet, Pencil, ShoppingBag, Utensils } from 'lucide-react';
import { CategoryLookup, groupOrderItems } from './order-item-presentation';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_META: Record<OrderItemStatus, { label: string; dot: string; pill: string; text: string }> = {
  PENDING:        { label: 'Pendente',    dot: 'bg-[var(--status-neutral)]', pill: 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]', text: 'text-[var(--status-neutral)]' },
  IN_PREPARATION: { label: 'Em preparo',  dot: 'bg-[var(--status-warning)]', pill: 'bg-[var(--status-warning-bg)] text-[var(--status-warning)]', text: 'text-[var(--status-warning)]' },
  READY:          { label: 'Pronto',      dot: 'bg-[var(--status-success)]', pill: 'bg-[var(--status-success-bg)] text-[var(--status-success)]', text: 'text-[var(--status-success)]' },
  DELIVERED:      { label: 'Entregue',    dot: 'bg-[var(--status-success)]', pill: 'bg-[var(--status-success-bg)] text-[var(--status-success)]', text: 'text-[var(--status-success)]' },
  CANCELLED:      { label: 'Cancelado',   dot: 'bg-[var(--border-strong)]',  pill: 'bg-[var(--bg-subtle)] text-[var(--text-muted)]', text: 'text-[var(--text-muted)] line-through' },
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
  categoryLookup = {},
  onMutated,
  onEditItem,
}: {
  order: Order;
  categoryLookup?: CategoryLookup;
  onMutated?: () => void;
  onEditItem?: (item: OrderItem) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = order.items ?? [];
  if (items.length === 0) return null;
  const itemGroups = groupOrderItems(items, categoryLookup);

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
      setError(getFriendlyErrorMessage(e, 'Não conseguimos atualizar o item.'));
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
      setError(getFriendlyErrorMessage(e, 'Não conseguimos cancelar o item.'));
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
        setError(getFriendlyErrorMessage(e, 'Não conseguimos marcar o item como entregue.'));
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
        <div className="rounded-xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] px-3 py-2 text-xs font-bold text-[var(--status-danger)]">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {itemGroups.map((group) => (
          <section key={group.id} aria-label={group.label}>
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="h-px flex-1 bg-[var(--border)]" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{group.label}</h4>
              <span className="h-px flex-1 bg-[var(--border)]" />
            </div>
            <ul className="space-y-2">
        {group.items.map((item) => {
          const meta = STATUS_META[item.status];
          const next = NEXT_QUICK[item.status];
          const isBusy = busyId === item.id;

          return (
            <li
              key={item.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${meta.dot}`} />
                    <span className="rounded-md bg-brand-charcoal px-1.5 py-0.5 text-[10px] font-black text-white">
                      {itemLabel(order, item)}
                    </span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${meta.pill}`}>
                      {meta.label}
                    </span>
                    {item.payment_status === 'PAID' && (
                      <span className="flex items-center gap-1 rounded-md bg-[var(--status-success-bg)] px-1.5 py-0.5 text-[10px] font-black text-[var(--status-success)]">
                        <Wallet className="h-2.5 w-2.5" /> Pago
                      </span>
                    )}
                    {item.is_takeout ? (
                      <span className="flex items-center gap-1 rounded-md bg-[var(--status-info-bg)] px-1.5 py-0.5 text-[10px] font-black text-[var(--status-info)]">
                        <ShoppingBag className="h-2.5 w-2.5" /> Levar
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-md bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-black text-[var(--text-secondary)]">
                        <Utensils className="h-2.5 w-2.5" /> Aqui
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <p className={`truncate text-sm font-bold ${meta.text}`}>
                      {item.quantity}× {item.product_name_snapshot}
                    </p>
                    <span className="shrink-0 text-xs font-black text-[var(--text-secondary)]">
                      {currency.format(Number(item.total_price))}
                    </span>
                  </div>

                  {/* Adicionais */}
                  {(item.addons ?? []).length > 0 && (
                    <div className="mt-1 space-y-0.5 pl-1 border-l-2 border-[var(--status-success)]/30">
                      {item.addons!.map((a) => (
                        <p key={a.id ?? a.addon_id} className="text-[11px] text-[var(--text-secondary)]">
                          + {a.addon_name_snapshot}
                          {(a.quantity > 1) && <span className="font-bold"> ×{a.quantity}</span>}
                          {Number(a.addon_price_snapshot) > 0 && (
                            <span className="ml-1 text-[var(--text-muted)]">
                              ({currency.format(Number(a.addon_price_snapshot) * a.quantity)})
                            </span>
                          )}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Ingredientes removidos */}
                  {(item.removed_ingredients ?? []).length > 0 && (
                    <p className="mt-0.5 text-[11px] italic text-[var(--status-danger)] pl-1">
                      Sem: {item.removed_ingredients!.map((r) => r.ingredient_name_snapshot).join(', ')}
                    </p>
                  )}

                  {item.observation && (() => {
                    const obs = item.observation.replace(/^\[VIAGEM\]\s*/, '').trim();
                    return obs ? (
                      <p className="mt-0.5 text-[11px] italic text-[var(--text-muted)]">&ldquo;{obs}&rdquo;</p>
                    ) : null;
                  })()}
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
                <div className="mt-2 flex items-center justify-end gap-2 border-t border-[var(--border)] pt-2 text-[10px] font-bold text-[var(--text-muted)]">
                  {item.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => pdvApi.updateOrderItemStatus({ orderItemId: item.id, newStatus: 'IN_PREPARATION' }).then(() => onMutated?.())}
                      className="flex items-center gap-1 rounded px-2 py-1 hover:bg-[var(--bg-subtle)]"
                    >
                      <Clock className="h-2.5 w-2.5" /> Iniciar preparo
                    </button>
                  )}
                  {onEditItem && order.status === 'NA_FILA' && item.status === 'PENDING' && item.payment_status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => onEditItem(item)}
                      disabled={isBusy}
                      className="flex items-center gap-1 rounded px-2 py-1 text-[var(--status-info)] hover:bg-[var(--status-info-bg)]"
                    >
                      <Pencil className="h-2.5 w-2.5" /> Editar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCancelItem(item)}
                    disabled={isBusy}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]"
                  >
                    <X className="h-2.5 w-2.5" /> Cancelar item
                  </button>
                </div>
              )}
            </li>
          );
        })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
