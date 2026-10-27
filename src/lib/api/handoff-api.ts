import { runWithAbortTimeout } from '../utils/abort-timeout';
import { createClient } from '../supabase/client';
import type { HandoffUnit, Order } from '@/types/pdv';

export type HandoffCommand = {
  p_command: string; p_order: string;
  p_targets: { id: string; version: number; revision: number }[];
  p_action: 'MANUAL' | 'MANUAL_RECOVERY' | 'REVOKE'; p_reason: string | null;
};
export async function enrichHandoffs(orders: Order[]): Promise<Order[]> {
  if (!orders.length) return orders;
  try {
    const { data, error } = await runWithAbortTimeout(async (signal) => await createClient().rpc('get_production_handoffs', { p_orders: orders.map((o) => o.id) }).abortSignal(signal), 8000, 'Consulta de repasse indisponível.');
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Resposta de repasse incompleta.');
    const grouped = new Map<string, HandoffUnit[]>();
    for (const unit of (data ?? []) as HandoffUnit[]) {
      const group = grouped.get(unit.order_id) ?? [];
      group.push(unit); grouped.set(unit.order_id, group);
    }
    return orders.map((o) => {
      const handoffs = grouped.get(o.id) ?? [];
      return { ...o, handoffs, handoff_signature: JSON.stringify(handoffs) };
    });
  } catch {
    // Migration/RPC/rede indisponível não derruba o quadro existente.
    return orders.map((o) => ({ ...o, handoffs: undefined, handoff_signature: 'unavailable' }));
  }
}

export const handoffApi = {
  confirm: async (command: HandoffCommand) => {
    const { data, error } = await runWithAbortTimeout(async (signal) => await createClient().rpc('confirm_production_handoff', command).abortSignal(signal), 12000, 'Resultado do repasse não confirmado.');
    if (error) throw error;
    return data as { changed: number };
  },
  configure: async (branch: string, sector: string, mode: string, enabled: boolean, version: number | null) => {
    const { error } = await runWithAbortTimeout(async (signal) => await createClient().rpc('configure_production_handoff', {
      p_branch: branch, p_sector: sector, p_mode: mode, p_enabled: enabled, p_version: version,
    }).abortSignal(signal), 12000, 'Configuração não confirmada.');
    if (error) throw error;
  },
};
