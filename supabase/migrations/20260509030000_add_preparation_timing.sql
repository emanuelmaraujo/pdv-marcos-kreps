-- Adds preparation timing columns to orders for future insights on average prep time.
-- queue_entered_at: set when order is confirmed (moves to NA_FILA)
-- preparation_started_at: set when attendant explicitly clicks "Iniciar Preparo" (optional)
-- preparation_finished_at: set when order is marked PRONTO

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS queue_entered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preparation_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preparation_finished_at TIMESTAMPTZ;

-- Back-fill existing orders from their timestamps
UPDATE orders SET queue_entered_at = confirmed_at WHERE queue_entered_at IS NULL AND confirmed_at IS NOT NULL;
UPDATE orders SET preparation_finished_at = ready_at WHERE preparation_finished_at IS NULL AND ready_at IS NOT NULL;
