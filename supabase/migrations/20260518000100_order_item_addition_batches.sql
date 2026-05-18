-- Migration: Order item addition batches
-- Date: 2026-05-18
-- Notes:
--   * Tracks the original item batch (1) and subsequent additions (2, 3, ...)
--     per order, so kitchen receipts can identify incremental additions without
--     reprinting the whole order.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS addition_batch_no SMALLINT NOT NULL DEFAULT 1;

UPDATE order_items
   SET addition_batch_no = 1
 WHERE addition_batch_no IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_addition_batch
  ON order_items(order_id, addition_batch_no);
