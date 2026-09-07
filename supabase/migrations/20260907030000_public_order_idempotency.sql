-- Migration: idempotência na criação de pedido público
-- Date: 2026-09-07
-- Notes:
--   * Bug observado: pedido #21 (EXPIRADO) e #23 (PAGO) de 05/09, mesma cliente,
--     mesmos 4 itens, mesmo total, criados com 53 segundos de diferença. O
--     checkout do /pedir criava um pedido NOVO a cada submit — um duplo toque,
--     um "voltar" no navegador ou um retry de pagamento gerava outro pedido,
--     que ficava ocupando número do dia e a fila até expirar.
--   * A tubulação já existia pela metade: create-public-order libera o header
--     x-idempotency-key no CORS desde sempre, mas nunca o lia, e o frontend
--     nunca o mandava.
--   * Guarda parcial (WHERE NOT NULL): pedido de atendente e registros antigos
--     seguem sem chave, sem colidir entre si.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS public_idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS orders_public_idempotency_key_uniq
  ON orders(public_idempotency_key)
  WHERE public_idempotency_key IS NOT NULL;

COMMENT ON COLUMN orders.public_idempotency_key IS
  'Chave enviada pelo checkout público (header x-idempotency-key). Mesma chave = mesmo pedido: o segundo submit devolve o pedido já criado em vez de duplicar.';
