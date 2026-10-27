'use client';

import { useRef, useState } from 'react';
import { AlertTriangle, CheckCheck, ClipboardCheck, Loader2, Printer } from 'lucide-react';
import type { HandoffUnit, Order } from '@/types/pdv';
import { handoffApi, type HandoffCommand } from '@/lib/api/handoff-api';

const printLabels = { PENDING: 'Impressão pendente', PROCESSING: 'Imprimindo', PRINTED: 'Impresso', FAILED: 'Falhou a impressão', SKIPPED: 'Impressão ignorada' };
const prepLabels = { PENDING: 'Aguardando preparo', IN_PREPARATION: 'Em preparo', READY: 'Pronto', DELIVERED: 'Entregue', CANCELLED: 'Cancelado' };

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
const eventLabels: Record<string, string> = { MANUAL: 'Anotado e repassado', MANUAL_RECOVERY: 'Recuperação manual', REVOKE: 'Confirmação corrigida', PRINT: 'Impresso' };
const time = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function ProductionHandoff({ order, onChanged, offline = false }: { order: Order; onChanged?: (id: string) => void; offline?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const pending = useRef<HandoffCommand | null>(null);
  const [retrying, setRetrying] = useState(false);
  const disabledOrder = ['AGUARDANDO_CONFIRMACAO','AGUARDANDO_PAGAMENTO','CANCELADO','EXPIRADO','ENTREGUE'].includes(order.status);
  const units = order.handoffs;
  const items = (order.items ?? []).filter((i) => i.status !== 'CANCELLED').sort((a, b) => (a.sequence_no ?? Number.MAX_SAFE_INTEGER) - (b.sequence_no ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
  const expectedUnits = items.filter((i) => i.production_sector !== 'NONE').reduce((sum, i) => sum + i.quantity, 0);
  const eligibleUnits = (units ?? []).filter((u) => items.some((i) => i.id === u.order_item_id));
  const run = async (unit?: HandoffUnit, action: HandoffCommand['p_action'] = 'MANUAL') => {
    if (busy || offline || (typeof navigator !== 'undefined' && !navigator.onLine)) { setMessage('Sem conexão. Reconecte e atualize antes de confirmar.'); return; }
    const command = pending.current ?? (unit ? {
      p_command: crypto.randomUUID(), p_order: order.id,
      p_targets: [{ id: unit.id, revision: unit.revision, version: unit.version }],
      p_action: action, p_reason: action === 'MANUAL' ? null : reason.trim(),
    } : null);
    if (!command) return;
    if (command.p_action !== 'MANUAL' && !command.p_reason) { setMessage('Informe o motivo antes de recuperar ou corrigir.'); return; }
    pending.current = command;
    setBusy(true); setMessage('');
    try {
      const result = await handoffApi.confirm(command);
      pending.current = null; setRetrying(false); setReason('');
      setMessage(result.changed ? 'Repasse registrado.' : 'Repasse já registrado.');
      onChanged?.(order.id);
    } catch (e) {
      const error = e as { code?: string; message?: string };
      // Erros Postgres confirmam rollback; falha de transporte conserva a chave.
      if (error.code && /^[0-9A-Z]{5}$/.test(error.code)) {
        pending.current = null; setRetrying(false);
        setMessage('Não registrado: ' + (error.message || 'Atualize e revise a seleção.'));
        onChanged?.(order.id);
      } else {
        setRetrying(true); setMessage('Resultado não confirmado. Tente novamente com a mesma chave antes de outra ação.');
      }
    } finally { setBusy(false); }
  };

  return <section aria-label="Repasse e preparo dos itens" className="space-y-3" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--text-secondary)]"><span>Repasse à produção</span><span>{units ? `${eligibleUnits.filter((u) => u.confirmed).length}/${expectedUnits} unidades repassadas` : 'Indisponível'}</span></div>
    {['AGUARDANDO_CONFIRMACAO','AGUARDANDO_PAGAMENTO'].includes(order.status) && <p className="rounded-xl bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-secondary)]">Repasse bloqueado até a liberação do pedido. A divisão de conta mantém a regra atual de produção após quitação.</p>}
    {offline && <p role="status" className="rounded-xl bg-[var(--bg-subtle)] p-3 text-xs font-semibold text-[var(--text-primary)]">Sem conexão. Dados da última atualização; confirmação de repasse bloqueada.</p>}
    {!units && <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-secondary)]">Não foi possível consultar o repasse. Atualize o quadro; nenhuma confirmação será presumida.</p>}
    {items.map((item) => {
      const itemUnits = (units ?? []).filter((u) => u.order_item_id === item.id);
      const outstanding = itemUnits.some((u) => !u.confirmed);
      const surface = outstanding ? 'border-[var(--status-danger)]/40 bg-[var(--status-danger-bg)]' : item.status === 'READY' ? 'border-[var(--status-info)]/40 bg-[var(--status-info-bg)]' : item.status === 'DELIVERED' ? 'border-[var(--status-success)]/40 bg-[var(--status-success-bg)]' : 'border-[var(--status-warning)]/40 bg-[var(--status-warning-bg)]';
      const unitRows = itemUnits.map((u) => <div key={u.id} className="mt-3 border-t border-[var(--border)] pt-2 text-xs">
          <p className="flex items-start gap-1.5 font-semibold text-[var(--text-primary)]">{u.confirmed ? <CheckCheck size={16} className="shrink-0" /> : u.mode === 'PRINTER' ? <Printer size={16} className="shrink-0" /> : <ClipboardCheck size={16} className="shrink-0" />}<span>Unidade {u.unit_no}/{item.quantity} · {handoffLabel(u)}</span></p>
          {u.confirmed_at && u.state === 'CONFIRMED' && <p className="mt-1 text-[var(--text-secondary)]">{u.actor_name || 'Operador'} · {time(u.confirmed_at)}</p>}
          {u.printed_at && <p className="mt-1 text-[var(--text-secondary)]">Job impresso · {time(u.printed_at)}</p>}
          {u.job_status === 'FAILED' && <p className="mt-1 flex gap-1 font-semibold text-[var(--status-danger)]"><AlertTriangle size={14} />Falha no job mais recente · confira a impressão</p>}
          {u.enabled && !disabledOrder && !['DELIVERED','CANCELLED'].includes(item.status) && !u.confirmed && <button type="button" disabled={busy || retrying || offline} onClick={() => void run(u, u.mode === 'MANUAL' ? 'MANUAL' : 'MANUAL_RECOVERY')} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 font-bold text-[var(--text-primary)] disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />}{u.mode === 'MANUAL' ? 'Anotado e repassado' : 'Confirmar recuperação manual'}</button>}
          {(u.history.length > 0 || u.can_manage) && <details className="mt-1"><summary className="flex min-h-11 cursor-pointer items-center font-medium text-[var(--text-secondary)]">Histórico e correção · unidade {u.unit_no}</summary><ol className="space-y-2">{u.history.map((h, n) => <li key={n} className="break-words">{eventLabels[h.origin] || 'Registro de repasse'} · {h.actor_name || 'Impressora'} · {time(h.created_at)}{h.reason ? ` · ${h.reason}` : ''}</li>)}</ol>{u.can_manage && u.state === 'CONFIRMED' && !disabledOrder && <button type="button" disabled={busy || retrying || offline} className="mt-2 min-h-11 rounded-lg border border-[var(--border)] px-3 text-[var(--text-primary)]" onClick={() => void run(u,'REVOKE')}>Corrigir confirmação manual</button>}</details>}
        </div>);
      const allConfirmed = itemUnits.length > 1 && itemUnits.every((u) => u.confirmed);
      const latest = [...itemUnits].sort((a,b) => (b.confirmed_at ?? b.printed_at ?? '').localeCompare(a.confirmed_at ?? a.printed_at ?? ''))[0];
      return <div key={item.id} className={`rounded-xl border p-3 ${surface}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-1"><h3 className="break-words text-sm font-bold text-[var(--text-primary)]">{item.quantity}× {item.product_name_snapshot}</h3><span className="text-[11px] text-[var(--text-secondary)]">Lote {item.addition_batch_no ?? 1} · item {item.sequence_no ?? '—'}</span></div>
        <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">◷ {prepLabels[item.status]}{item.quantity > 1 ? ' · preparo por linha inteira' : ''}{item.is_takeout ? ' · PARA VIAGEM' : ''}</p>
        {(item.addons ?? []).map((a) => <p key={a.id ?? a.addon_id} className="mt-1 break-words text-xs text-[var(--text-secondary)]">+ {a.quantity}× {a.addon_name_snapshot}</p>)}
        {!!item.removed_ingredients?.length && <p className="mt-1 break-words text-xs font-medium text-[var(--status-danger)]">Sem {item.removed_ingredients.map((i) => i.ingredient_name_snapshot).join(', ')}</p>}
        {item.observation && <p className="mt-1 break-words text-xs text-[var(--text-secondary)]">{item.observation}</p>}
        {item.production_sector === 'NONE' && <p className="mt-2 text-xs text-[var(--text-secondary)]">Sem repasse de produção</p>}
        {item.production_sector !== 'NONE' && units && !itemUnits.length && <p className="mt-2 text-xs text-[var(--text-secondary)]">Repasse desconhecido · atualize para reconciliar</p>}
        {allConfirmed ? <details className="mt-2 border-t border-[var(--border)] pt-2"><summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold text-[var(--text-primary)]">✓ {itemUnits.length}/{item.quantity} unidades repassadas · Ver unidades e histórico</summary>{unitRows}</details> : unitRows}
        {allConfirmed && latest && <p className="text-xs text-[var(--text-secondary)]">Último: {latest.state === 'CONFIRMED' ? latest.actor_name : 'Impressora'}{latest.confirmed_at || latest.printed_at ? ` · ${time((latest.confirmed_at || latest.printed_at)!)}` : ''}</p>}

      </div>;
    })}
    {!!eligibleUnits.some((u) => u.mode === 'PRINTER' || u.can_manage) && <label className="block text-xs font-semibold text-[var(--text-secondary)]">Motivo para recuperação ou correção<input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} disabled={busy || retrying || offline} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-base text-[var(--text-primary)]" /></label>}
    {retrying && <button type="button" disabled={busy || offline} onClick={() => void run()} className="min-h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm font-semibold">Verificar novamente o mesmo repasse</button>}
    <p role="status" className="text-xs font-medium text-[var(--text-secondary)]">{message}</p>
  </section>;
}
