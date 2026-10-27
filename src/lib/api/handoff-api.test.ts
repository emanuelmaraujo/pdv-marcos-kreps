import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@/types/pdv';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('../supabase/client', () => ({ createClient: () => ({ rpc }) }));
import { enrichHandoffs } from './handoff-api';
const orders = [{ id: 'a', total_amount: 90 }, { id: 'b', total_amount: 30 }] as Order[];
beforeEach(() => rpc.mockReset());
describe('consulta de repasse isolada do quadro', () => {
 it('preserva pedidos e valores se a RPC estiver indisponível', async () => {
  rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ error: { code:'PGRST202' }, data:null }) });
  const result = await enrichHandoffs(orders);
  expect(result.map((o) => o.total_amount)).toEqual([90,30]);
  expect(result.every((o) => o.handoffs === undefined && o.handoff_signature === 'unavailable')).toBe(true);
 });
 it('não interpreta resposta incompleta como zero repassados', async () => {
  rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data:null, error:null }) });
  expect((await enrichHandoffs(orders))[0].handoffs).toBeUndefined();
 });
 it('agrupa a evidência por pedido, sem duplicar cartões', async () => {
  rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data:[{ id:'unit',order_id:'a',confirmed:true }], error:null }) });
  const result = await enrichHandoffs(orders);
  expect(result).toHaveLength(2);
  expect(result[0].handoffs).toHaveLength(1);
  expect(result[1].handoffs).toEqual([]);
 });
});
