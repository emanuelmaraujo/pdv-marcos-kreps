-- Migration: Web Push para "pedido pronto" no /pedir
-- Date: 2026-08-19
-- Notes:
--   * Cliente público não tem login — a inscrição de push é amarrada ao
--     order_id (via public_token na edge function), não a um usuário.
--   * Sem policy pública: só service_role (via edge functions) lê/escreve.
--     Igual ao padrão já usado em whatsapp_messages / rate_limit_hits.
--   * UNIQUE (order_id, endpoint) — mesmo navegador pode reinscrever no
--     mesmo pedido sem duplicar linha (ex: usuário atualiza a página).

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_order ON push_subscriptions(order_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy criada de propósito — só service_role (que ignora RLS) mexe
-- nesta tabela, via subscribe-order-push e send-order-ready-push.
