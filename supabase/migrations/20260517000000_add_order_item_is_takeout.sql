-- Migration: Adiciona coluna is_takeout em order_items
-- Permite rastrear por item (não só pelo order.type) quais krepes são para levar,
-- necessário para calcular a taxa de embalagem por item corretamente.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS is_takeout BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: itens com [VIAGEM] na observation já eram para levar
UPDATE order_items
   SET is_takeout = TRUE
 WHERE observation LIKE '[VIAGEM]%';

CREATE INDEX IF NOT EXISTS idx_order_items_is_takeout
  ON order_items(order_id, is_takeout)
  WHERE is_takeout = TRUE;
