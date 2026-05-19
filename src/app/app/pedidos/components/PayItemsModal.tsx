'use client';

import { useEffect, useMemo, useState } from 'react';
import { Order, OrderItem, PaymentMethod, PaymentStatus } from '@/types/pdv';
import { pdvApi } from '@/lib/api/pdv-api';
import {
  X,
  Loader2,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  CheckCircle2,
  AlertCircle,
  ListChecks,
  Clock,
  Gift,
  ArrowLeft,
} from 'lucide-react';

const METHODS: {
  value: PaymentMethod;
  label: string;
  Icon: React.FC<{ className?: string }>;
  colors: string;
}[] = [
  { value: 'PIX', label: 'PIX', Icon: Smartphone, colors: 'border-teal-200 bg-teal-50 text-teal-700' },
  { value: 'CASH', label: 'Dinheiro', Icon: Banknote, colors: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  { value: 'DEBIT_CARD', label: 'Debito', Icon: CreditCard, colors: 'border-blue-200 bg-blue-50 text-blue-700' },
  { value: 'CREDIT_CARD', label: 'Credito', Icon: Wallet, colors: 'border-violet-200 bg-violet-50 text-violet-700' },
  { value: 'COURTESY', label: 'Cortesia', Icon: Gift, colors: 'border-pink-200 bg-pink-50 text-pink-700' },
  { value: 'IFOOD', label: 'iFood', Icon: Smartphone, colors: 'border-red-200 bg-red-50 text-red-700' },
  { value: 'PENDING', label: 'Pendente', Icon: Clock, colors: 'border-amber-200 bg-amber-50 text-amber-700' },
];

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  PIX: 'PIX',
  CASH: 'Dinheiro',
  DEBIT_CARD: 'Debito',
  CREDIT_CARD: 'Credito',
  IFOOD: 'iFood',
  COURTESY: 'Cortesia',
  PENDING: 'Pendente',
};

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function itemLabel(order: Order, item: OrderItem): string {
  const num = String(order.daily_number).padStart(3, '0');
  const code = order.branch?.code ?? '';
  const base = code ? `${code}-${num}` : num;
  return item.sequence_no != null ? `${base}-${item.sequence_no}` : base;
}

function isItemPaid(item: OrderItem) {
  return item.payment_status === 'PAID' || item.payment_status === 'COURTESY';
}

function paymentStatusForMethod(method: PaymentMethod): PaymentStatus {
  if (method === 'COURTESY') return 'COURTESY';
  if (method === 'PENDING') return 'PENDING';
  return 'PAID';
}

interface Props {
  order: Order;
  onClose: () => void;
  onPaid: () => void;
  onPaymentRegistered?: () => void;
  includeIfood?: boolean;
  allowIfood?: boolean;
  allowPending?: boolean;
  context?: 'new-order' | 'pending-settlement';
}

export function PayItemsModal({
  order,
  onClose,
  onPaid,
  onPaymentRegistered,
  includeIfood,
  allowIfood,
  allowPending = false,
  context,
}: Props) {
  const [items, setItems] = useState<OrderItem[]>(order.items ?? []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'select' | 'method'>('select');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [ifoodAmountStr, setIfoodAmountStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUseIfood = includeIfood ?? allowIfood ?? context === 'new-order';

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setItems(order.items ?? []);
      setSelected(new Set());
      setStep('select');
      setPaymentMethod('PIX');
      setIfoodAmountStr('');
      setError(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [order.id, order.items]);

  const availableMethods = useMemo(
    () => METHODS.filter((method) => {
      if (method.value === 'IFOOD') return canUseIfood;
      if (method.value === 'PENDING') return allowPending;
      return true;
    }),
    [allowPending, canUseIfood],
  );

  const activeItems = items.filter((item) => item.status !== 'CANCELLED');
  const unpaidItems = activeItems.filter((item) => !isItemPaid(item));
  const selectedItems = unpaidItems.filter((item) => selected.has(item.id));
  const selectedItemsTotal = selectedItems.reduce((sum, item) => sum + Number(item.total_price ?? 0), 0);
  const packingFeeAmount = Number(order.packing_fee ?? 0);
  const shouldChargePackingFee = !order.paid_at && packingFeeAmount > 0;
  const isPayingAllRemaining = selected.size > 0 && selected.size === unpaidItems.length;
  const selectedTotal = selectedItemsTotal + (isPayingAllRemaining && shouldChargePackingFee ? packingFeeAmount : 0);
  const pendingTotal = unpaidItems.reduce((sum, item) => sum + Number(item.total_price ?? 0), 0)
    + (shouldChargePackingFee ? packingFeeAmount : 0);
  const pendingAfterSelection = Math.max(0, pendingTotal - selectedTotal);
  const allSelected = selected.size > 0 && selected.size === unpaidItems.length;
  const ifoodAmount = parseFloat(ifoodAmountStr.replace(',', '.')) || 0;
  const orderLabel = order.branch?.code
    ? `${order.branch.code}-${String(order.daily_number).padStart(3, '0')}`
    : `#${String(order.daily_number).padStart(3, '0')}`;

  function toggleItem(itemId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function selectAllPending() {
    setSelected(allSelected ? new Set() : new Set(unpaidItems.map((item) => item.id)));
  }

  async function confirmPayment() {
    if (selected.size === 0) {
      setError('Selecione pelo menos 1 item.');
      return;
    }
    if (paymentMethod === 'IFOOD' && (!ifoodAmountStr.trim() || ifoodAmount < 0)) {
      setError('Informe o valor cobrado no iFood.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextStatus = paymentStatusForMethod(paymentMethod);
      const itemIds = Array.from(selected);

      if (paymentMethod !== 'PENDING') {
        await pdvApi.markPayment({
          orderId: order.id,
          paymentMethod,
          status: nextStatus,
          amount: selectedTotal,
          orderItemIds: itemIds,
          ifoodChargedAmount: paymentMethod === 'IFOOD' ? ifoodAmount : undefined,
        });
      }

      setItems((current) => current.map((item) => (
        selected.has(item.id)
          ? {
              ...item,
              payment_status: nextStatus,
              payment_method: paymentMethod,
              paid_at: paymentMethod === 'PENDING' ? item.paid_at : new Date().toISOString(),
            }
          : item
      )));
      setSelected(new Set());
      setStep('select');
      setIfoodAmountStr('');
      onPaymentRegistered?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar pagamento.');
    } finally {
      setLoading(false);
    }
  }

  const completed = unpaidItems.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm sm:items-center sm:justify-center">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl sm:rounded-3xl">
        <div className="shrink-0 border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-black text-[var(--text-primary)]">Pagamento por itens</p>
              <p className="mt-0.5 text-xs font-medium text-[var(--text-secondary)]">
                Pedido {orderLabel} - {unpaidItems.length} pendente{unpaidItems.length !== 1 ? 's' : ''} - {currency.format(pendingTotal)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-xl p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCell label="Selecionados" value={selected.size} />
            <SummaryCell label="Total selecionado" value={currency.format(selectedTotal)} strong />
            <SummaryCell label="Pendentes" value={Math.max(0, unpaidItems.length - selected.size)} />
            <SummaryCell label="Valor pendente" value={currency.format(pendingAfterSelection)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {completed ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-[var(--status-success)]" />
              <div>
                <p className="text-sm font-black text-[var(--text-primary)]">Todos os itens foram baixados.</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">O pedido nao possui itens pendentes de pagamento.</p>
              </div>
            </div>
          ) : step === 'select' ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={selectAllPending}
                className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-left transition-all hover:bg-[var(--bg-surface)]"
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${allSelected ? 'border-brand-red bg-brand-red' : 'border-[var(--border-strong)]'}`}>
                  {allSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                </span>
                <span className="flex-1 text-sm font-black text-[var(--text-primary)]">
                  {allSelected ? 'Desmarcar todos os pendentes' : 'Selecionar todos os pendentes'}
                </span>
                <span className="text-sm font-black text-[var(--text-secondary)]">{currency.format(pendingTotal)}</span>
              </button>

              <div className="space-y-2">
                {activeItems.map((item) => {
                  const paid = isItemPaid(item);
                  const checked = selected.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => !paid && toggleItem(item.id)}
                      disabled={paid}
                      className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all ${
                        paid
                          ? 'cursor-not-allowed border-[var(--border)] bg-[var(--bg-subtle)] opacity-85'
                          : checked
                          ? 'border-brand-red/40 bg-brand-red/5 ring-2 ring-brand-red/10'
                          : 'border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]'
                      }`}
                    >
                      <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                        paid
                          ? 'border-[var(--status-success)] bg-[var(--status-success)]'
                          : checked
                          ? 'border-brand-red bg-brand-red'
                          : 'border-[var(--border-strong)]'
                      }`}>
                        {(checked || paid) && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-[var(--bg-inverse)] px-1.5 py-0.5 text-[10px] font-black text-white">
                            {itemLabel(order, item)}
                          </span>
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${
                            paid
                              ? 'bg-[var(--status-success-bg)] text-[var(--status-success)]'
                              : checked
                              ? 'bg-brand-red/10 text-brand-red'
                              : 'bg-[var(--status-warning-bg)] text-[var(--status-warning)]'
                          }`}>
                            {paid ? 'Pago' : checked ? 'Selecionado' : 'Pendente'}
                          </span>
                          {paid && item.payment_method && item.payment_method !== 'PENDING' && (
                            <span className="rounded-md bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-black text-[var(--text-secondary)]">
                              {PAYMENT_LABEL[item.payment_method]}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-baseline justify-between gap-3">
                          <p className={`truncate text-sm font-bold ${paid ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-primary)]'}`}>
                            {item.quantity}x {item.product_name_snapshot}
                          </p>
                          <span className="shrink-0 text-sm font-black text-[var(--text-primary)]">
                            {currency.format(Number(item.total_price))}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setStep('select')}
                className="inline-flex items-center gap-2 rounded-xl px-2 py-1 text-xs font-black text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar para selecao
              </button>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Lote selecionado</p>
                <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">
                  {selected.size} item{selected.size !== 1 ? 's' : ''} - {currency.format(selectedTotal)}
                </p>
                {isPayingAllRemaining && shouldChargePackingFee && (
                  <p className="mt-1 text-xs font-bold text-[var(--status-warning)]">
                    Inclui taxa de embalagem: {currency.format(packingFeeAmount)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Forma de pagamento</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {availableMethods.map(({ value, label, Icon, colors }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPaymentMethod(value)}
                      className={`flex h-16 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 text-xs font-black transition-all active:scale-95 ${
                        paymentMethod === value
                          ? `${colors} ring-2 ring-current/20`
                          : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'IFOOD' && canUseIfood && (
                <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Valor cobrado no iFood</p>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={selectedTotal.toFixed(2).replace('.', ',')}
                    value={ifoodAmountStr}
                    onChange={(event) => setIfoodAmountStr(event.target.value)}
                    className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-brand-red"
                  />
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--text-secondary)]">Diferenca</span>
                    <span className="font-black text-[var(--text-primary)]">
                      {ifoodAmount - selectedTotal > 0 ? '+' : '-'} {currency.format(Math.abs(ifoodAmount - selectedTotal))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-3 border-t border-[var(--border)] px-5 py-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] px-3 py-2.5 text-xs font-bold text-[var(--status-danger)]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {completed ? (
            <button
              type="button"
              onClick={onPaid}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--status-success)] px-5 text-sm font-black text-white shadow-[var(--shadow-sm)] active:scale-95"
            >
              <CheckCircle2 className="h-4 w-4" />
              Finalizar pagamento
            </button>
          ) : step === 'select' ? (
            <button
              type="button"
              onClick={() => {
                if (selected.size === 0) {
                  setError('Selecione pelo menos 1 item antes de continuar.');
                  return;
                }
                setError(null);
                setStep('method');
              }}
              disabled={selected.size === 0}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--bg-inverse)] px-5 text-sm font-black text-white shadow-[var(--shadow-sm)] transition-all active:scale-95 disabled:opacity-50"
            >
              <ListChecks className="h-4 w-4" />
              Escolher forma de pagamento
            </button>
          ) : (
            <button
              type="button"
              onClick={confirmPayment}
              disabled={loading || selected.size === 0}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-red px-5 text-sm font-black text-white shadow-[var(--shadow-sm)] shadow-brand-red/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {loading ? 'Registrando...' : 'Registrar pagamento'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCell({ label, value, strong = false }: { label: string; value: string | number; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
      <p className={`mt-0.5 truncate text-sm ${strong ? 'font-black text-brand-red' : 'font-bold text-[var(--text-primary)]'}`}>
        {value}
      </p>
    </div>
  );
}
