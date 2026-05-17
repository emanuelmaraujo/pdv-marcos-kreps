'use client';

import { useState } from 'react';
import { Order, OrderItem, PaymentMethod } from '@/types/pdv';
import { pdvApi } from '@/lib/api/pdv-api';
import {
  X, Loader2, CreditCard, Banknote, Smartphone,
  Wallet, CheckCircle2, AlertCircle, Users, ListChecks,
} from 'lucide-react';

// ─── Métodos disponíveis ──────────────────────────────────────────────────────

const METHODS: {
  value: PaymentMethod;
  label: string;
  short: string;
  Icon: React.FC<{ className?: string }>;
  colors: string;
}[] = [
  { value: 'PIX',         label: 'Pix',      short: 'Pix',      Icon: Smartphone,  colors: 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100' },
  { value: 'CASH',        label: 'Dinheiro', short: 'Dinheiro', Icon: Banknote,    colors: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  { value: 'DEBIT_CARD',  label: 'Débito',   short: 'Débito',   Icon: CreditCard,  colors: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' },
  { value: 'CREDIT_CARD', label: 'Crédito',  short: 'Crédito',  Icon: Wallet,      colors: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100' },
  { value: 'COURTESY',    label: 'Cortesia', short: 'Cortesia', Icon: CheckCircle2,colors: 'border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100' },
];

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function itemLabel(order: Order, item: OrderItem): string {
  const num = String(order.daily_number).padStart(3, '0');
  const code = order.branch?.code ?? '';
  const base = code ? `${code}-${num}` : num;
  return item.sequence_no != null ? `${base}-${item.sequence_no}` : base;
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  order: Order;
  onClose: () => void;
  onPaid: () => void;
}

type Mode = 'per-person' | 'batch';

export function PayItemsModal({ order, onClose, onPaid }: Props) {
  const unpaidItems = (order.items ?? []).filter(
    (i) => i.status !== 'CANCELLED' && i.payment_status !== 'PAID' && i.payment_status !== 'COURTESY',
  );

  const [mode, setMode] = useState<Mode>('per-person');
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(unpaidItems.map((i) => i.id)));
  const [batchMethod, setBatchMethod] = useState<PaymentMethod>('PIX');
  const [batchLoading, setBatchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paidCount, setPaidCount] = useState(0);

  const selectedItems = unpaidItems.filter((i) => selected.has(i.id));
  const batchTotal = selectedItems.reduce((s, i) => s + Number(i.total_price), 0);
  const isAll = selected.size === unpaidItems.length && unpaidItems.length > 0;

  // ── Pagar 1 item direto (modo por pessoa) ─────────────────────────────────
  async function payOneItem(item: OrderItem, method: PaymentMethod) {
    if (busyItemId) return;
    setBusyItemId(item.id);
    setError(null);
    try {
      await pdvApi.markPayment({
        orderId: order.id,
        paymentMethod: method,
        status: method === 'COURTESY' ? 'COURTESY' : 'PAID',
        amount: Number(item.total_price),
        orderItemIds: [item.id],
      });
      setPaidCount((c) => c + 1);
      // Se todos pagaram, avisa e fecha
      if (paidCount + 1 >= unpaidItems.length) {
        onPaid();
        onClose();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar pagamento.');
    } finally {
      setBusyItemId(null);
    }
  }

  // ── Pagar em lote (modo batch) ────────────────────────────────────────────
  async function payBatch() {
    if (selected.size === 0) { setError('Selecione pelo menos 1 item.'); return; }
    setBatchLoading(true);
    setError(null);
    try {
      const scope = selected.size === unpaidItems.length ? undefined : [...selected];
      await pdvApi.markPayment({
        orderId: order.id,
        paymentMethod: batchMethod,
        status: batchMethod === 'COURTESY' ? 'COURTESY' : 'PAID',
        amount: batchTotal,
        orderItemIds: scope,
      });
      onPaid();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar pagamento.');
    } finally {
      setBatchLoading(false);
    }
  }

  const dailyNum = String(order.daily_number).padStart(3, '0');
  const branchCode = order.branch?.code;
  const orderLabel = branchCode ? `${branchCode}-${dailyNum}` : `#${dailyNum}`;
  const pendingTotal = unpaidItems.reduce((s, i) => s + Number(i.total_price), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm sm:items-center sm:justify-center">
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl flex flex-col max-h-[92vh]">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-zinc-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-black text-zinc-900">Dividir conta</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Pedido {orderLabel} · {unpaidItems.length} item{unpaidItems.length !== 1 ? 's' : ''} pendente{unpaidItems.length !== 1 ? 's' : ''} · {currency.format(pendingTotal)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-xl p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mode toggle */}
          <div className="mt-3 flex gap-1.5 rounded-2xl bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => setMode('per-person')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition-all ${
                mode === 'per-person'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Por pessoa
            </button>
            <button
              type="button"
              onClick={() => setMode('batch')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition-all ${
                mode === 'batch'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <ListChecks className="h-3.5 w-3.5" />
              Em lote
            </button>
          </div>
        </div>

        {/* ── Conteúdo ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {unpaidItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <p className="text-sm font-bold text-zinc-500">Todos os itens já foram pagos.</p>
            </div>
          ) : mode === 'per-person' ? (

            /* ── Modo Por Pessoa ─────────────────────────────────────────── */
            <div className="divide-y divide-zinc-100">
              <p className="px-5 py-3 text-[11px] font-bold text-zinc-400">
                Toque no método de pagamento ao lado de cada item para cobrar individualmente.
              </p>
              {unpaidItems.map((item) => {
                const isBusy = busyItemId === item.id;
                const isPaid = !unpaidItems.find((i) => i.id === item.id) || false;
                return (
                  <div key={item.id} className="px-5 py-4 space-y-3">
                    {/* Info do item */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 rounded-lg bg-zinc-900 px-2 py-0.5 text-[10px] font-black text-white">
                          {itemLabel(order, item)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-zinc-900">
                            {item.quantity}× {item.product_name_snapshot}
                          </p>
                          {item.status === 'DELIVERED' && (
                            <p className="text-[10px] text-emerald-600 font-semibold">Já entregue</p>
                          )}
                        </div>
                      </div>
                      <p className="shrink-0 text-base font-black text-zinc-900">
                        {currency.format(Number(item.total_price))}
                      </p>
                    </div>

                    {/* Botões de método inline */}
                    <div className={`grid grid-cols-5 gap-1.5 transition-opacity ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}>
                      {METHODS.map(({ value, short, Icon, colors }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => payOneItem(item, value)}
                          disabled={!!busyItemId}
                          className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[10px] font-black transition-all active:scale-95 disabled:cursor-not-allowed ${colors}`}
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Icon className="h-4 w-4" />
                          )}
                          <span className="leading-none">{short}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

          ) : (

            /* ── Modo Em Lote ────────────────────────────────────────────── */
            <div className="px-5 py-4 space-y-4">
              {/* Selecionar todos */}
              <button
                type="button"
                onClick={() => setSelected(isAll ? new Set() : new Set(unpaidItems.map((i) => i.id)))}
                className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-left transition-all hover:bg-zinc-50"
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                  isAll ? 'border-brand-red bg-brand-red' : 'border-zinc-300'
                }`}>
                  {isAll && <CheckCircle2 className="h-3 w-3 text-white" />}
                </span>
                <span className="flex-1 text-sm font-bold text-zinc-700">
                  {isAll ? 'Desmarcar todos' : 'Selecionar todos'}
                </span>
                <span className="text-sm font-black text-zinc-500">
                  {currency.format(unpaidItems.reduce((s, i) => s + Number(i.total_price), 0))}
                </span>
              </button>

              {/* Lista de itens */}
              <div className="space-y-2">
                {unpaidItems.map((item) => {
                  const checked = selected.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelected((prev) => {
                        const next = new Set(prev);
                        next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                        return next;
                      })}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all ${
                        checked
                          ? 'border-brand-red/30 bg-red-50 ring-1 ring-brand-red/20'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50'
                      }`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                        checked ? 'border-brand-red bg-brand-red' : 'border-zinc-300'
                      }`}>
                        {checked && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 rounded-md bg-zinc-900 px-1.5 py-0.5 text-[10px] font-black text-white">
                            {itemLabel(order, item)}
                          </span>
                          <span className="truncate text-sm font-bold text-zinc-800">
                            {item.quantity}× {item.product_name_snapshot}
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-black text-zinc-900">
                        {currency.format(Number(item.total_price))}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Método de pagamento */}
              {selected.size > 0 && (
                <div className="space-y-2.5">
                  <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Forma de pagamento</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {METHODS.map(({ value, short, Icon, colors }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setBatchMethod(value)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-[10px] font-black transition-all ${
                          batchMethod === value
                            ? `${colors} ring-2 ring-inset ring-current/30`
                            : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{short}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-zinc-100 px-5 py-4 space-y-3">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {mode === 'per-person' ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Ainda pendente</p>
                <p className="text-lg font-black text-zinc-900">{currency.format(pendingTotal)}</p>
              </div>
              <button
                type="button"
                onClick={() => { setMode('batch'); setSelected(new Set(unpaidItems.map((i) => i.id))); }}
                className="flex items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-xs font-black text-white transition-all hover:bg-zinc-700 active:scale-95"
              >
                <ListChecks className="h-4 w-4" />
                Cobrar tudo junto
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total selecionado</p>
                <p className="text-xl font-black text-zinc-900">{currency.format(batchTotal)}</p>
              </div>
              <button
                type="button"
                onClick={payBatch}
                disabled={batchLoading || selected.size === 0}
                className="flex items-center gap-2 rounded-2xl bg-brand-red px-5 py-3 text-sm font-black text-white shadow-md shadow-brand-red/25 transition-all hover:bg-brand-red/90 active:scale-95 disabled:opacity-50"
              >
                {batchLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <CheckCircle2 className="h-4 w-4" />
                }
                {batchLoading
                  ? 'Registrando...'
                  : `Cobrar ${selected.size} item${selected.size !== 1 ? 's' : ''}`
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
