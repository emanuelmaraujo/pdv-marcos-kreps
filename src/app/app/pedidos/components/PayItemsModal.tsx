'use client';

import { useState } from 'react';
import { Order, OrderItem, PaymentMethod } from '@/types/pdv';
import { pdvApi } from '@/lib/api/pdv-api';
import { X, Loader2, CreditCard, Banknote, Smartphone, Wallet, CheckCircle2, AlertCircle } from 'lucide-react';

const METHODS: { value: PaymentMethod; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { value: 'PIX',         label: 'Pix',         Icon: Smartphone },
  { value: 'CASH',        label: 'Dinheiro',    Icon: Banknote },
  { value: 'DEBIT_CARD',  label: 'Débito',      Icon: CreditCard },
  { value: 'CREDIT_CARD', label: 'Crédito',     Icon: Wallet },
  { value: 'COURTESY',    label: 'Cortesia',    Icon: CheckCircle2 },
];

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  order: Order;
  onClose: () => void;
  onPaid: () => void;
}

export function PayItemsModal({ order, onClose, onPaid }: Props) {
  const items = (order.items ?? []).filter(
    (i) => i.status !== 'CANCELLED' && i.payment_status !== 'PAID' && i.payment_status !== 'COURTESY',
  );

  const [selected, setSelected] = useState<Set<string>>(new Set(items.map((i) => i.id)));
  const [method, setMethod] = useState<PaymentMethod>('PIX');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItems = items.filter((i) => selected.has(i.id));
  const total = selectedItems.reduce((sum, i) => sum + Number(i.total_price), 0);
  const isAll = selected.size === items.length && items.length > 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(isAll ? new Set() : new Set(items.map((i) => i.id)));
  }

  function itemLabel(item: OrderItem): string {
    const num = String(order.daily_number).padStart(3, '0');
    const code = order.branch?.code ?? '';
    const base = code ? `${code}-${num}` : num;
    return item.sequence_no != null ? `${base}-${item.sequence_no}` : base;
  }

  async function handlePay() {
    if (selected.size === 0) { setError('Selecione pelo menos 1 item.'); return; }
    setLoading(true);
    setError(null);
    try {
      const scope = selected.size === items.length ? undefined : [...selected];
      await pdvApi.markPayment({
        orderId: order.id,
        paymentMethod: method,
        status: method === 'COURTESY' ? 'COURTESY' : 'PAID',
        amount: total,
        orderItemIds: scope,
      });
      onPaid();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar pagamento.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center">
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 shrink-0">
          <div>
            <p className="text-sm font-black text-zinc-900">Pagar itens</p>
            <p className="text-[11px] text-zinc-500">Pedido #{String(order.daily_number).padStart(3, '0')} · selecione o que pagar</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Lista de itens */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {items.length === 0 ? (
            <p className="text-center text-sm text-zinc-500 py-6">Nenhum item pendente de pagamento.</p>
          ) : (
            <>
              {/* Selecionar todos */}
              <button
                type="button"
                onClick={toggleAll}
                className="flex w-full items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded border ${isAll ? 'bg-brand-red border-brand-red' : 'border-zinc-300'}`}>
                  {isAll && <CheckCircle2 className="h-3 w-3 text-white" />}
                </span>
                {isAll ? 'Desmarcar todos' : 'Selecionar todos'}
                <span className="ml-auto text-zinc-400">{currency.format(items.reduce((s, i) => s + Number(i.total_price), 0))}</span>
              </button>

              {items.map((item) => {
                const checked = selected.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all ${
                      checked ? 'border-brand-red/40 bg-red-50' : 'border-zinc-200 bg-white hover:bg-zinc-50'
                    }`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'bg-brand-red border-brand-red' : 'border-zinc-300'}`}>
                      {checked && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-black text-white">{itemLabel(item)}</span>
                        <span className="truncate text-xs font-bold text-zinc-800">
                          {item.quantity}× {item.product_name_snapshot}
                        </span>
                      </div>
                      {item.status === 'DELIVERED' && (
                        <p className="text-[10px] font-bold text-emerald-600 mt-0.5">Já entregue</p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-black text-zinc-700">{currency.format(Number(item.total_price))}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Método de pagamento */}
        {items.length > 0 && (
          <div className="border-t border-zinc-100 px-4 pt-3 pb-1 shrink-0">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Forma de pagamento</p>
            <div className="flex flex-wrap gap-2">
              {METHODS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMethod(value)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                    method === value
                      ? 'border-brand-red bg-red-50 text-brand-red'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="shrink-0 border-t border-zinc-100 px-4 py-3 space-y-2">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total selecionado</p>
              <p className="text-xl font-black text-zinc-900">{currency.format(total)}</p>
            </div>
            <button
              type="button"
              onClick={handlePay}
              disabled={loading || selected.size === 0 || items.length === 0}
              className="flex items-center gap-2 rounded-xl bg-brand-red px-5 py-3 text-sm font-black text-white shadow-sm transition-all hover:bg-brand-red/90 active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {loading ? 'Registrando...' : `Pagar ${selected.size} item${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
