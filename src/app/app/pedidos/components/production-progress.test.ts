import { describe, expect, it } from 'vitest';
import type { HandoffUnit, Order, OrderItem } from '@/types/pdv';
import { productionProgress } from './production-progress';
import { isDefinitivePrepError } from './ProductionHandoff';

const item = (id: string, quantity: number, status: OrderItem['status'], sector = 'KITCHEN') =>
  ({ id, quantity, status, production_sector: sector }) as OrderItem;
const unit = (order_item_id: string, prep_status: HandoffUnit['prep_status']) =>
  ({ order_item_id, prep_status }) as HandoffUnit;

describe('progresso de produção do cartão', () => {
  it('ignora linhas e unidades canceladas', () => {
    const order = {
      items: [item('a', 2, 'CANCELLED'), item('b', 2, 'READY')],
      handoffs: [unit('a', 'CANCELLED'), unit('a', 'CANCELLED'), unit('b', 'READY'), unit('b', 'READY')],
    } as Pick<Order, 'items' | 'handoffs'>;
    expect(productionProgress(order)).toEqual({ done: 2, total: 2 });
  });
  it('soma itens sem repasse (bebidas) pela quantidade da linha', () => {
    const order = {
      items: [item('c', 2, 'IN_PREPARATION'), item('s', 1, 'PENDING', 'JUICE_POTATO'), item('w', 2, 'READY', 'NONE')],
      handoffs: [unit('c', 'READY'), unit('c', 'PENDING'), unit('s', 'PENDING')],
    } as Pick<Order, 'items' | 'handoffs'>;
    expect(productionProgress(order)).toEqual({ done: 3, total: 5 });
  });
  it('sem consulta de repasse, conta pelas linhas', () => {
    expect(productionProgress({ items: [item('c', 3, 'READY'), item('d', 1, 'PENDING')], handoffs: undefined })).toEqual({ done: 3, total: 4 });
  });
});

describe('recuperação de comando de preparo', () => {
  it('4xx é definitivo (transação desfeita); rede e 5xx pedem repetição segura', () => {
    expect(isDefinitivePrepError(new Error('[update-order-item-status] Status: 400 | Error: Só unidades prontas'))).toBe(true);
    expect(isDefinitivePrepError(new Error('[update-order-item-status] Status: 503 | Error: Repita a ação'))).toBe(false);
    expect(isDefinitivePrepError(new Error('[update-order-item-status] Failed to send a request to the Edge Function'))).toBe(false);
  });
});
