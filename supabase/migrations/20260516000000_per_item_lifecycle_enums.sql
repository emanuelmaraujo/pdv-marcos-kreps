-- Migration: Per-item lifecycle — Phase 1A (enums only)
-- Date: 2026-05-16
-- Notes:
--   * Apenas adiciona valores aos ENUMs existentes. Não usa-os ainda — o uso
--     fica na migration seguinte porque Postgres proíbe usar um valor de enum
--     recém-adicionado na mesma transação que o adicionou.
--   * Aditiva. Pedidos/itens existentes continuam funcionando.

-- ----------------------------------------------------------------------------
-- 1. Novo enum para o ciclo de vida do item de pedido.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_item_status') THEN
    CREATE TYPE order_item_status AS ENUM (
      'PENDING',
      'IN_PREPARATION',
      'READY',
      'DELIVERED',
      'CANCELLED'
    );
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- 2. Novos valores em enums existentes.
--    * order_status.PRONTO_PARCIAL  -> pelo menos 1 item READY/DELIVERED + outros pendentes.
--    * payment_status.PARTIAL       -> pelo menos 1 item pago + outros pendentes.
-- ----------------------------------------------------------------------------
ALTER TYPE order_status   ADD VALUE IF NOT EXISTS 'PRONTO_PARCIAL' BEFORE 'PRONTO';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'PARTIAL'        BEFORE 'PAID';
