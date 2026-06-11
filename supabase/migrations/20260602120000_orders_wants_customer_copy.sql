-- Adiciona flag de "cliente quer a via" em pedidos do atendente.
-- NULL = pedido legado/origem APP/QR onde o atendente nunca decidiu.
-- TRUE/FALSE = atendente explicitamente marcou no checkout.
-- A edge function create-attendant-order so imprime via CUSTOMER quando TRUE.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS wants_customer_copy boolean;

COMMENT ON COLUMN orders.wants_customer_copy IS
  'Atendente marcou explicitamente que o cliente quer a via dele impressa. NULL para pedidos onde nao foi perguntado (legado, /pedir, QR).';
