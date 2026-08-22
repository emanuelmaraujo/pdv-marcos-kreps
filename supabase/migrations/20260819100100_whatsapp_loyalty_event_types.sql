-- Migration: Fidelidade — Fase 0 (governança)
-- Notes:
--   * chk_whatsapp_messages_event_type não incluía os 3 eventos de fidelidade
--     (loyalty_stamp_earned, loyalty_reward_ready, loyalty_reward_expiring).
--     O helper _shared/whatsapp-enqueue.ts em produção já tenta enfileirar
--     esses eventos — sem essa migration, o insert falha na CHECK constraint.
--   * whatsapp_messages.order_id era NOT NULL. loyalty-expire dispara
--     loyalty_reward_expiring sem order_id (o aviso de recompensa vencendo é
--     do cron diário, não nasce de um pedido específico) — o insert falharia
--     também por violar NOT NULL, mesmo depois de corrigir o CHECK acima.
--     A trava de idempotência de loyalty_reward_expiring já é feita via
--     audit_logs (LOYALTY_REWARD_EXPIRING_NOTIFIED) em loyalty-expire, não
--     depende de order_id — tornar a coluna nullable é seguro.
--   * uniq_whatsapp_messages_order_event_live é (order_id, event_type) — em
--     Postgres, NULL != NULL num índice único, então múltiplas linhas com
--     order_id nulo não colidem entre si. Nenhuma mudança necessária nela.

ALTER TABLE whatsapp_messages ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS chk_whatsapp_messages_event_type;

ALTER TABLE whatsapp_messages
  ADD CONSTRAINT chk_whatsapp_messages_event_type
  CHECK (event_type IN (
    'order_received',
    'order_ready',
    'order_partial_ready',
    'order_out_for_delivery',
    'loyalty_stamp_earned',
    'loyalty_reward_ready',
    'loyalty_reward_expiring'
  ));
