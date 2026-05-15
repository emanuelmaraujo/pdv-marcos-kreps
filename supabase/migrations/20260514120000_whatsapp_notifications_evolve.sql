-- Migration: Evolve WhatsApp notifications pipeline (event_type, idempotency, retries, opt-in)
-- Date: 2026-05-14
-- Notes:
--   * Aditiva apenas: nada e destrutivo, todos os ADD COLUMN/INSERT usam IF NOT EXISTS / ON CONFLICT.
--   * Padroniza dois eventos transacionais: order_received (novo_pedido) e order_ready (pedido_pronto).
--   * Garante idempotencia (1 envio por order x evento) e fila com retry + backoff.
--   * Coluna legada message_type fica preservada para compatibilidade.

-- =============================================================================
-- 1. whatsapp_messages: novos campos
-- =============================================================================
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT,
  ADD COLUMN IF NOT EXISTS customer_opt_in BOOLEAN,
  ADD COLUMN IF NOT EXISTS error_code TEXT;

-- Backfill event_type a partir de message_type (legacy)
UPDATE whatsapp_messages
SET event_type = CASE
  WHEN message_type IN ('order_received', 'order_ready') THEN message_type
  WHEN message_type ILIKE '%ready%' OR message_type ILIKE '%pronto%' THEN 'order_ready'
  WHEN message_type ILIKE '%received%' OR message_type ILIKE '%recebido%' OR message_type ILIKE '%novo%' THEN 'order_received'
  ELSE 'order_ready'
END
WHERE event_type IS NULL;

ALTER TABLE whatsapp_messages
  ALTER COLUMN event_type SET NOT NULL;

ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS chk_whatsapp_messages_event_type;
ALTER TABLE whatsapp_messages
  ADD CONSTRAINT chk_whatsapp_messages_event_type
  CHECK (event_type IN ('order_received', 'order_ready'));

ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS chk_whatsapp_messages_delivery_status;
ALTER TABLE whatsapp_messages
  ADD CONSTRAINT chk_whatsapp_messages_delivery_status
  CHECK (
    delivery_status IS NULL OR delivery_status IN (
      'SENT', 'DELIVERED', 'READ', 'FAILED_BY_PROVIDER', 'UNDELIVERED'
    )
  );

-- =============================================================================
-- 2. Idempotencia: 1 linha "viva" por (order_id, event_type)
--    "viva" = ainda pode tentar entregar ou ja foi entregue.
--    FAILED definitivo nao bloqueia, mas worker nao re-enfileira (reseta a propria linha).
-- =============================================================================
DROP INDEX IF EXISTS uniq_whatsapp_messages_order_event_live;
CREATE UNIQUE INDEX uniq_whatsapp_messages_order_event_live
  ON whatsapp_messages (order_id, event_type)
  WHERE status IN ('PENDING', 'SENT', 'SKIPPED');

-- =============================================================================
-- 3. Indices para o worker
-- =============================================================================
DROP INDEX IF EXISTS idx_whatsapp_messages_queue;
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_due
  ON whatsapp_messages (status, next_retry_at NULLS FIRST, scheduled_at)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_provider_id
  ON whatsapp_messages (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- =============================================================================
-- 4. RLS: leitura por equipe permanece; mutacoes ficam restritas ao service role
--    (Edge Functions). Frontend nunca faz INSERT/UPDATE direto.
-- =============================================================================
DROP POLICY IF EXISTS "Equipe gerencia whatsapp_messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "Equipe le whatsapp_messages" ON whatsapp_messages;
CREATE POLICY "Equipe le whatsapp_messages"
  ON whatsapp_messages FOR SELECT TO authenticated
  USING (get_my_role() IN ('ADMIN', 'ATTENDANT'));

DROP POLICY IF EXISTS "Admin gerencia whatsapp_messages" ON whatsapp_messages;
CREATE POLICY "Admin gerencia whatsapp_messages"
  ON whatsapp_messages FOR UPDATE TO authenticated
  USING (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

-- =============================================================================
-- 5. customers: opt-in transacional WhatsApp (independente de marketing_opt_in)
--    Default TRUE: ao criar pedido o cliente concorda implicitamente em receber
--    notificacoes sobre o proprio pedido. Texto explicito sera mostrado no /pedir.
-- =============================================================================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_updated_at TIMESTAMPTZ;

-- =============================================================================
-- 6. settings: template para "novo pedido" + bump da Graph API recomendada
-- =============================================================================
INSERT INTO settings (key, value) VALUES
  ('whatsapp_template_received', '"novo_pedido"'),
  ('whatsapp_api_version', '"v21.0"')
ON CONFLICT (key) DO NOTHING;
