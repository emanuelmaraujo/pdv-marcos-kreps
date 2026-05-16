-- Migration: WhatsApp event "order_partial_ready"
-- Date: 2026-05-16
-- Notes:
--   * Adiciona o event_type `order_partial_ready` ao CHECK de whatsapp_messages.
--   * Cria a setting global de template default `whatsapp_template_partial_ready`.
--   * Esse evento dispara quando o pedido entra em PRONTO_PARCIAL pela primeira vez
--     (primeiro item ficou pronto). O disparo é feito pelo edge function
--     update-order-item-status; o partial unique index existente garante 1 envio.

-- Atualiza o CHECK constraint para incluir o novo evento.
ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS chk_whatsapp_messages_event_type;

ALTER TABLE whatsapp_messages
  ADD CONSTRAINT chk_whatsapp_messages_event_type
  CHECK (event_type IN ('order_received', 'order_ready', 'order_partial_ready'));

-- Template default global. Sobrescrito por branches.whatsapp_templates[event_type].template_name.
INSERT INTO settings (key, value)
VALUES ('whatsapp_template_partial_ready', '"pedido_parcial_pronto"'::jsonb)
ON CONFLICT (key) DO NOTHING;
