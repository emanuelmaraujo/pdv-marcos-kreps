import type { Order, OrderItemStatus } from '@/types/pdv';

const DONE: OrderItemStatus[] = ['READY', 'DELIVERED'];

/**
 * Progresso de produção do pedido em unidades físicas.
 * Linhas canceladas e unidades canceladas ficam fora; linhas com unidades
 * de repasse contam por unidade, as demais (ex.: setor NONE ou repasse
 * indisponível) contam pela quantidade com o status da linha.
 */
export function productionProgress(order: Pick<Order, 'items' | 'handoffs'>): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const item of order.items ?? []) {
    if (item.status === 'CANCELLED') continue;
    const units = (order.handoffs ?? []).filter((u) => u.order_item_id === item.id && u.prep_status !== 'CANCELLED');
    if (units.length > 0) {
      total += units.length;
      done += units.filter((u) => DONE.includes(u.prep_status ?? 'PENDING')).length;
    } else {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      total += quantity;
      if (DONE.includes(item.status)) done += quantity;
    }
  }
  return { done, total };
}
