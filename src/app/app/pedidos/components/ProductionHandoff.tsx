'use client';

import { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  ChefHat,
  ClipboardCheck,
  Clock,
  Loader2,
  Package,
  Printer,
} from 'lucide-react';
import type { HandoffUnit, Order } from '@/types/pdv';
import { handoffApi, type HandoffCommand } from '@/lib/api/handoff-api';
import { pdvApi } from '@/lib/api/pdv-api';
import { getFriendlyErrorMessage } from '@/lib/errors/messages';

const printLabels = {
  PENDING: 'Impressão pendente',
  PROCESSING: 'Imprimindo',
  PRINTED: 'Impresso',
  FAILED: 'Falhou a impressão',
  SKIPPED: 'Impressão ignorada',
};

const prepLabels: Record<string, string> = {
  PENDING: 'Aguardando preparo',
  IN_PREPARATION: 'Em preparo',
  READY: 'Pronto',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

export function handoffLabel(unit: HandoffUnit) {
  if (unit.state === 'CONFIRMED') {
    const origin = unit.confirmation_origin ?? unit.history.find((h) => h.origin === 'MANUAL' || h.origin === 'MANUAL_RECOVERY')?.origin;
    return origin === 'MANUAL_RECOVERY' || (!origin && unit.mode === 'PRINTER') ? 'Recuperação manual confirmada' : 'Anotado e repassado';
  }
  if (unit.printed_at) return 'Impresso';
  if (!unit.enabled) return 'Repasse não configurado';
  if (unit.mode === 'PRINTER') return unit.job_status === 'PRINTED' ? 'Job sem confirmação verificável' : unit.job_status ? printLabels[unit.job_status] : 'Sem evidência de impressão';
  return unit.state === 'UNKNOWN' ? 'Repasse legado desconhecido' : 'Aguardando anotar / repassar';
}

const eventLabels: Record<string, string> = {
  MANUAL: 'Anotado e repassado',
  MANUAL_RECOVERY: 'Recuperação manual',
  REVOKE: 'Confirmação corrigida',
  PRINT: 'Impresso',
};

const time = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function ProductionHandoff({
  order,
  onChanged,
  offline = false,
}: {
  order: Order;
  onChanged?: (id: string) => void;
  offline?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const pending = useRef<HandoffCommand | null>(null);
  const [retrying, setRetrying] = useState(false);

  const disabledOrder = ['AGUARDANDO_CONFIRMACAO', 'AGUARDANDO_PAGAMENTO', 'CANCELADO', 'EXPIRADO', 'ENTREGUE'].includes(order.status);
  const units = order.handoffs;
  const items = (order.items ?? [])
    .filter((i) => i.status !== 'CANCELLED')
    .sort((a, b) => (a.sequence_no ?? Number.MAX_SAFE_INTEGER) - (b.sequence_no ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
  const expectedUnits = items.filter((i) => i.production_sector !== 'NONE').reduce((sum, i) => sum + i.quantity, 0);
  const eligibleUnits = (units ?? []).filter((u) => items.some((i) => i.id === u.order_item_id));

  const runHandoff = async (unit?: HandoffUnit, action: HandoffCommand['p_action'] = 'MANUAL') => {
    if (busy || offline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setMessage('Sem conexão. Reconecte e atualize antes de confirmar.');
      return;
    }
    const command = pending.current ?? (unit ? {
      p_command: crypto.randomUUID(),
      p_order: order.id,
      p_targets: [{ id: unit.id, revision: unit.revision, version: unit.version }],
      p_action: action,
      p_reason: action === 'MANUAL' ? null : reason.trim(),
    } : null);
    if (!command) return;
    if (command.p_action !== 'MANUAL' && !command.p_reason) {
      setMessage('Informe o motivo antes de recuperar ou corrigir.');
      return;
    }
    pending.current = command;
    setBusy(true);
    setMessage('');
    try {
      const result = await handoffApi.confirm(command);
      pending.current = null;
      setRetrying(false);
      setReason('');
      setMessage(result.changed ? 'Repasse registrado.' : 'Repasse já registrado.');
      onChanged?.(order.id);
    } catch (e) {
      const error = e as { code?: string; message?: string };
      if (error.code && /^[0-9A-Z]{5}$/.test(error.code)) {
        pending.current = null;
        setRetrying(false);
        setMessage('Não registrado: ' + (error.message || 'Atualize e revise a seleção.'));
        onChanged?.(order.id);
      } else {
        setRetrying(true);
        setMessage('Resultado não confirmado. Tente novamente com a mesma chave antes de outra ação.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePrepUpdate = async (params: {
    unitIds?: string[];
    itemIds?: string[];
    newStatus: 'IN_PREPARATION' | 'READY' | 'DELIVERED';
    reasonText?: string;
  }) => {
    if (busy || offline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setMessage('Sem conexão. Reconecte e atualize antes de alterar o preparo.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await pdvApi.batchUpdateProductionStatus({
        orderId: order.id,
        unitIds: params.unitIds,
        itemIds: params.itemIds,
        newStatus: params.newStatus,
        reason: params.reasonText,
      });
      setMessage(`Status atualizado para ${prepLabels[params.newStatus]}.`);
      onChanged?.(order.id);
    } catch (e) {
      setMessage(getFriendlyErrorMessage(e, 'Erro ao atualizar produção. Tente novamente.'));
      onChanged?.(order.id);
    } finally {
      setBusy(false);
    }
  };

  const allReadyUnitsInOrder = eligibleUnits.filter((u) => (u.prep_status || 'PENDING') === 'READY');

  return (
    <section aria-label="Repasse e preparo dos itens" className="space-y-3" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--text-secondary)]">
        <span>Repasse à produção</span>
        <span>{units ? `${eligibleUnits.filter((u) => u.confirmed).length}/${expectedUnits} unidades repassadas` : 'Indisponível'}</span>
      </div>

      {['AGUARDANDO_CONFIRMACAO', 'AGUARDANDO_PAGAMENTO'].includes(order.status) && (
        <p className="rounded-xl bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-secondary)]">
          Repasse bloqueado até a liberação do pedido. A divisão de conta mantém a regra atual de produção após quitação.
        </p>
      )}

      {offline && (
        <p role="status" className="rounded-xl bg-[var(--bg-subtle)] p-3 text-xs font-semibold text-[var(--text-primary)]">
          Sem conexão. Dados da última atualização; confirmação de repasse bloqueada.
        </p>
      )}

      {!units && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-secondary)]">
          Não foi possível consultar o repasse. Atualize o quadro; nenhuma confirmação será presumida.
        </p>
      )}

      {allReadyUnitsInOrder.length > 0 && order.type !== 'ENTREGA' && !disabledOrder && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--status-success)]/40 bg-[var(--status-success-bg)] p-2.5 text-xs">
          <span className="font-bold text-[var(--status-success)]">
            {allReadyUnitsInOrder.length} {allReadyUnitsInOrder.length === 1 ? 'unidade pronta' : 'unidades prontas'}
          </span>
          <button
            type="button"
            disabled={busy || offline}
            onClick={() => void handlePrepUpdate({ unitIds: allReadyUnitsInOrder.map((u) => u.id), newStatus: 'DELIVERED' })}
            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--status-success)] px-3 py-2 text-xs font-black uppercase tracking-wide text-white shadow-sm hover:opacity-95 active:scale-95 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
            Entregar prontas ({allReadyUnitsInOrder.length})
          </button>
        </div>
      )}

      {items.map((item) => {
        const itemUnits = (units ?? []).filter((u) => u.order_item_id === item.id);
        const outstanding = itemUnits.some((u) => !u.confirmed);
        const surface = outstanding
          ? 'border-[var(--status-danger)]/40 bg-[var(--status-danger-bg)]'
          : item.status === 'READY'
            ? 'border-[var(--status-info)]/40 bg-[var(--status-info-bg)]'
            : item.status === 'DELIVERED'
              ? 'border-[var(--status-success)]/30 bg-[var(--status-success-bg)]/30 opacity-80'
              : 'border-[var(--status-warning)]/40 bg-[var(--status-warning-bg)]';

        const unreadyUnits = itemUnits.filter((u) => !['READY', 'DELIVERED', 'CANCELLED'].includes(u.prep_status || 'PENDING'));
        const readyUnits = itemUnits.filter((u) => (u.prep_status || 'PENDING') === 'READY');

        return (
          <div key={item.id} className={`rounded-xl border p-3 ${surface}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-1">
              <h3 className="break-words text-sm font-bold text-[var(--text-primary)]">
                {item.quantity}× {item.product_name_snapshot}
              </h3>
              <span className="text-[11px] text-[var(--text-secondary)]">
                Lote {item.addition_batch_no ?? 1} · item {item.sequence_no ?? '—'}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
              <span>◷ {prepLabels[item.status]}</span>
              {item.is_takeout && (
                <span className="rounded bg-[var(--status-warning-bg)] px-1.5 py-0.5 text-[10px] font-black uppercase text-[var(--status-warning)]">
                  Para viagem
                </span>
              )}
            </div>

            {(item.addons ?? []).map((a) => (
              <p key={a.id ?? a.addon_id} className="mt-1 break-words text-xs text-[var(--text-secondary)]">
                + {a.quantity}× {a.addon_name_snapshot}
              </p>
            ))}
            {!!item.removed_ingredients?.length && (
              <p className="mt-1 break-words text-xs font-medium text-[var(--status-danger)]">
                Sem {item.removed_ingredients.map((i) => i.ingredient_name_snapshot).join(', ')}
              </p>
            )}
            {item.observation && <p className="mt-1 break-words text-xs text-[var(--text-secondary)]">{item.observation}</p>}

            {/* Ações em lote por item */}
            {itemUnits.length > 1 && !disabledOrder && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2">
                {unreadyUnits.length > 0 && (
                  <button
                    type="button"
                    disabled={busy || offline}
                    onClick={() => void handlePrepUpdate({ unitIds: unreadyUnits.map((u) => u.id), newStatus: 'READY' })}
                    className="flex min-h-11 items-center gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle2 size={13} />
                    Todas prontas ({unreadyUnits.length})
                  </button>
                )}
                {readyUnits.length > 0 && order.type !== 'ENTREGA' && (
                  <button
                    type="button"
                    disabled={busy || offline}
                    onClick={() => void handlePrepUpdate({ unitIds: readyUnits.map((u) => u.id), newStatus: 'DELIVERED' })}
                    className="flex min-h-11 items-center gap-1 rounded-lg border border-[var(--status-success)]/40 bg-[var(--status-success-bg)] px-2.5 py-1 text-[11px] font-black text-[var(--status-success)] hover:bg-[var(--status-success-bg)]/80 active:scale-95 disabled:opacity-50"
                  >
                    <Package size={13} />
                    Entregar prontas ({readyUnits.length})
                  </button>
                )}
              </div>
            )}

            {/* Sem repasse (ex: bebidas prontas de balcão) */}
            {item.production_sector === 'NONE' && (
              <div className="mt-2 border-t border-[var(--border)] pt-2 text-xs">
                <p className="text-[var(--text-secondary)]">Sem repasse de produção</p>
                {!disabledOrder && item.status !== 'DELIVERED' && item.status !== 'CANCELLED' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.status === 'PENDING' && (
                      <button
                        type="button"
                        disabled={busy || offline}
                        onClick={() => void handlePrepUpdate({ itemIds: [item.id], newStatus: 'IN_PREPARATION' })}
                        className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] active:scale-95 disabled:opacity-50"
                      >
                        <Clock size={14} /> Preparar
                      </button>
                    )}
                    {(item.status === 'PENDING' || item.status === 'IN_PREPARATION') && (
                      <button
                        type="button"
                        disabled={busy || offline}
                        onClick={() => void handlePrepUpdate({ itemIds: [item.id], newStatus: 'READY' })}
                        className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-brand-charcoal px-2.5 py-1.5 text-xs font-black uppercase text-white hover:bg-zinc-700 active:scale-95 disabled:opacity-50"
                      >
                        <ChefHat size={14} /> Marcar pronto
                      </button>
                    )}
                    {item.status === 'READY' && order.type !== 'ENTREGA' && (
                      <button
                        type="button"
                        disabled={busy || offline}
                        onClick={() => void handlePrepUpdate({ itemIds: [item.id], newStatus: 'DELIVERED' })}
                        className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--status-success)] px-3 py-2 text-xs font-black uppercase text-white hover:opacity-90 active:scale-95 disabled:opacity-50"
                      >
                        <CheckCheck size={14} /> Entregar item
                      </button>
                    )}
                    {item.status === 'READY' && order.type === 'ENTREGA' && (
                      <span className="flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-700">
                        Pronto p/ motoboy
                      </span>
                    )}
                  </div>
                )}
                {item.status === 'DELIVERED' && (
                  <div className="mt-2 flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--status-success-bg)] px-3 py-2 text-xs font-bold text-[var(--status-success)]">
                    <CheckCheck size={16} /> Item entregue
                  </div>
                )}
              </div>
            )}

            {item.production_sector !== 'NONE' && units && !itemUnits.length && (
              <p className="mt-2 text-xs text-[var(--text-secondary)]">Repasse desconhecido · atualize para reconciliar</p>
            )}

            {/* Lista individual de unidades com ciclo completo de preparo e entrega */}
            {itemUnits.map((u) => {
              const uPrep = u.prep_status || 'PENDING';
              return (
                <div
                  key={u.id}
                  className={`mt-3 rounded-xl border p-2.5 text-xs transition-colors ${
                    uPrep === 'DELIVERED'
                      ? 'border-[var(--status-success)]/30 bg-[var(--status-success-bg)]/20 opacity-80'
                      : uPrep === 'READY'
                        ? 'border-[var(--status-success)]/50 bg-[var(--status-success-bg)]/40'
                        : uPrep === 'IN_PREPARATION'
                          ? 'border-[var(--status-warning)]/50 bg-[var(--status-warning-bg)]/40'
                          : 'border-[var(--border)] bg-[var(--bg-surface)]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                      {u.confirmed ? (
                        <CheckCheck size={16} className="text-[var(--status-success)] shrink-0" />
                      ) : u.mode === 'PRINTER' ? (
                        <Printer size={16} className="shrink-0 text-[var(--status-warning)]" />
                      ) : (
                        <ClipboardCheck size={16} className="shrink-0 text-[var(--text-muted)]" />
                      )}
                      <span>Unidade {u.unit_no}/{item.quantity}</span>
                    </p>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${
                        uPrep === 'DELIVERED'
                          ? 'bg-[var(--status-success-bg)] text-[var(--status-success)]'
                          : uPrep === 'READY'
                            ? 'bg-[var(--status-success-bg)] text-[var(--status-success)]'
                            : uPrep === 'IN_PREPARATION'
                              ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning)]'
                              : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {prepLabels[uPrep]}
                    </span>
                  </div>

                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                    {handoffLabel(u)}
                    {u.confirmed_at && u.state === 'CONFIRMED' && ` · ${u.actor_name || 'Operador'} · ${time(u.confirmed_at)}`}
                    {u.printed_at && ` · ${time(u.printed_at)}`}
                  </p>

                  {u.job_status === 'FAILED' && (
                    <p className="mt-1 flex items-center gap-1 font-semibold text-[var(--status-danger)]">
                      <AlertTriangle size={14} /> Falha no job mais recente · confira a impressão
                    </p>
                  )}

                  {/* Controles de Preparo e Entrega por Unidade */}
                  {!disabledOrder && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {uPrep === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            disabled={busy || offline}
                            onClick={() => void handlePrepUpdate({ unitIds: [u.id], newStatus: 'IN_PREPARATION' })}
                            className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 font-bold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] active:scale-95 disabled:opacity-50"
                          >
                            <Clock size={14} /> Preparar
                          </button>
                          <button
                            type="button"
                            disabled={busy || offline}
                            onClick={() => void handlePrepUpdate({ unitIds: [u.id], newStatus: 'READY' })}
                            className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-brand-charcoal px-2.5 py-1.5 font-black uppercase text-white hover:bg-zinc-700 active:scale-95 disabled:opacity-50"
                          >
                            <ChefHat size={14} /> Marcar pronto
                          </button>
                        </>
                      )}

                      {uPrep === 'IN_PREPARATION' && (
                        <button
                          type="button"
                          disabled={busy || offline}
                          onClick={() => void handlePrepUpdate({ unitIds: [u.id], newStatus: 'READY' })}
                          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-charcoal px-3 py-2 font-black uppercase text-white hover:bg-zinc-700 active:scale-95 disabled:opacity-50"
                        >
                          <ChefHat size={14} /> Marcar pronto
                        </button>
                      )}

                      {uPrep === 'READY' && order.type !== 'ENTREGA' && (
                        <button
                          type="button"
                          disabled={busy || offline}
                          onClick={() => void handlePrepUpdate({ unitIds: [u.id], newStatus: 'DELIVERED' })}
                          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--status-success)] px-3 py-2 font-black uppercase text-white hover:opacity-90 active:scale-95 disabled:opacity-50"
                        >
                          <CheckCheck size={14} /> Entregar unidade
                        </button>
                      )}

                      {uPrep === 'READY' && order.type === 'ENTREGA' && (
                        <span className="flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-500/10 px-3 py-2 font-bold text-blue-700">
                          Pronto p/ motoboy
                        </span>
                      )}

                      {uPrep === 'DELIVERED' && (
                        <div className="flex min-h-11 w-full items-center justify-between rounded-xl bg-[var(--status-success-bg)] px-3 py-2 font-bold text-[var(--status-success)]">
                          <span className="flex items-center gap-1.5">
                            <CheckCheck size={16} /> Unidade entregue
                          </span>
                          {u.delivered_at && <span className="text-[11px] font-normal">{time(u.delivered_at)}</span>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Confirmação manual de repasse quando não confirmada */}
                  {u.enabled && !disabledOrder && !['DELIVERED', 'CANCELLED'].includes(uPrep) && !u.confirmed && (
                    <button
                      type="button"
                      disabled={busy || retrying || offline}
                      onClick={() => void runHandoff(u, u.mode === 'MANUAL' ? 'MANUAL' : 'MANUAL_RECOVERY')}
                      className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 font-bold text-[var(--text-primary)] disabled:opacity-50"
                    >
                      {busy && <Loader2 size={14} className="animate-spin" />}
                      {u.mode === 'MANUAL' ? 'Anotado e repassado' : 'Confirmar recuperação manual'}
                    </button>
                  )}

                  {/* Histórico e correção */}
                  {(u.history.length > 0 || u.can_manage) && (
                    <details className="mt-1.5">
                      <summary className="flex min-h-11 cursor-pointer items-center font-medium text-[var(--text-secondary)]">
                        Histórico e correção · unidade {u.unit_no}
                      </summary>
                      <ol className="mt-1 space-y-1 pl-2 border-l border-[var(--border)]">
                        {u.history.map((h, n) => (
                          <li key={n} className="break-words text-[11px] text-[var(--text-secondary)]">
                            {eventLabels[h.origin] || 'Registro de repasse'} · {h.actor_name || 'Impressora'} · {time(h.created_at)}
                            {h.reason ? ` · ${h.reason}` : ''}
                          </li>
                        ))}
                      </ol>
                      {u.can_manage && u.state === 'CONFIRMED' && !disabledOrder && (
                        <button
                          type="button"
                          disabled={busy || retrying || offline}
                          className="mt-2 min-h-11 rounded-lg border border-[var(--border)] px-3 text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                          onClick={() => void runHandoff(u, 'REVOKE')}
                        >
                          Corrigir confirmação manual
                        </button>
                      )}
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {!!eligibleUnits.some((u) => u.mode === 'PRINTER' || u.can_manage) && (
        <label className="block text-xs font-semibold text-[var(--text-secondary)]">
          Motivo para recuperação ou correção
          <input
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy || retrying || offline}
            className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-base text-[var(--text-primary)]"
          />
        </label>
      )}

      {retrying && (
        <button
          type="button"
          disabled={busy || offline}
          onClick={() => void runHandoff()}
          className="min-h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm font-semibold"
        >
          Verificar novamente o mesmo repasse
        </button>
      )}

      {message && <p role="status" className="text-xs font-medium text-[var(--text-secondary)]">{message}</p>}
    </section>
  );
}
