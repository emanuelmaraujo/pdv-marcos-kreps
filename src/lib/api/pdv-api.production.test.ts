import { beforeEach, describe, expect, it, vi } from 'vitest';
const invoke = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
vi.mock('../supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) },
    functions: { invoke },
    rpc,
  }),
}));
import { pdvApi } from './pdv-api';
beforeEach(() => { invoke.mockReset(); rpc.mockReset(); });
describe('lote de preparo por unidade (#229 / 1B)', () => {
  it('passa pela Edge Function para manter WhatsApp/Push de pronto', async () => {
    invoke.mockResolvedValue({ data: { success: true, order_status: 'PRONTO' }, error: null });
    await pdvApi.batchUpdateProductionStatus({ orderId: 'o1', unitIds: ['u1'], newStatus: 'READY' });
    expect(rpc).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith('update-order-item-status', expect.objectContaining({
      body: { mode: 'batch', order_id: 'o1', unit_ids: ['u1'], item_ids: [], new_status: 'READY', reason: undefined },
    }));
  });
});
