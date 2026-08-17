-- Migration: Delivery — Fase 2 (evento WhatsApp "saiu para entrega")
-- Notes:
--   * Adiciona o event_type `order_out_for_delivery` ao CHECK de whatsapp_messages.
--   * Disparado por dispatch-delivery quando o pedido de ENTREGA vira SAIU_PARA_ENTREGA.
--   * Mesmo padrão dos demais eventos: idempotente via uniq_whatsapp_messages_order_event_live,
--     não bloqueia a resposta da Edge Function em caso de falha.

ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS chk_whatsapp_messages_event_type;

ALTER TABLE whatsapp_messages
  ADD CONSTRAINT chk_whatsapp_messages_event_type
  CHECK (event_type IN ('order_received', 'order_ready', 'order_partial_ready', 'order_out_for_delivery'));

INSERT INTO settings (key, value)
VALUES ('whatsapp_template_out_for_delivery', '"pedido_saiu_entrega"'::jsonb)
ON CONFLICT (key) DO NOTHING;
