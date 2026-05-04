-- Migration: Add missing columns to whatsapp_messages
-- Needed by Edge Function send-whatsapp to track delivery status and errors

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

-- Add a CHECK constraint to enforce valid status values
ALTER TABLE whatsapp_messages
  ADD CONSTRAINT chk_whatsapp_messages_status
  CHECK (status IN ('PENDING', 'SENT', 'FAILED'));
