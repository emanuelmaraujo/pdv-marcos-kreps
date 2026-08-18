-- Migration: Índices de performance do board de pedidos (Fase P2.1)
-- Date: 2026-08-17
-- Notes:
--   * idx_orders_branch_created (branch_id, created_at) e
--     idx_orders_status_created_at (status, created_at) já existiam. Falta
--     cobertura pra filtro por payment_status combinado com filial/data, que
--     telas de caixa/relatório e possíveis views futuras do board usam.

CREATE INDEX IF NOT EXISTS idx_orders_branch_payment_status_created_at
  ON orders(branch_id, payment_status, created_at);
