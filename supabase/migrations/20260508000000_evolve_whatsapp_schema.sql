-- Migration: Evolve whatsapp_messages schema and initialize settings
-- Author: Antigravity
-- Date: 2026-05-08

-- 1. Evolve whatsapp_messages table without destructive changes
ALTER TABLE whatsapp_messages 
  ADD COLUMN IF NOT EXISTS template_name TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB,
  ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

-- 2. Update status check constraint to include SKIPPED
ALTER TABLE whatsapp_messages DROP CONSTRAINT IF EXISTS chk_whatsapp_messages_status;
ALTER TABLE whatsapp_messages 
  ADD CONSTRAINT chk_whatsapp_messages_status 
  CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED'));

-- 3. Initialize WhatsApp Settings (Non-sensitive)
INSERT INTO settings (key, value) VALUES 
  ('whatsapp_enabled', '"false"'),
  ('whatsapp_template_ready', '"pedido_pronto"'),
  ('whatsapp_template_language', '"pt_BR"'),
  ('whatsapp_test_phone', '""')
ON CONFLICT (key) DO NOTHING;

-- 4. Indices for queue processing
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_queue 
ON whatsapp_messages (status, created_at) 
WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_order_template 
ON whatsapp_messages (order_id, template_name);
