-- Migration: Delivery — Fase 2 (taxa/habilitação de entrega por filial)
-- Notes:
--   * Fase 1 usava settings globais únicas: `delivery_enabled`, `default_delivery_fee`.
--   * Fase 2 move isso para colunas por filial, mesmo padrão já usado por
--     `branches.packing_fee`/`branches.ordering_enabled`.
--   * Decisão de negócio confirmada: descontinuar os settings globais depois de
--     migrar os dados (não manter como fallback) — todas as filiais ativas
--     herdam o valor global atual como ponto de partida e passam a ser
--     configuradas individualmente em /app/configuracoes/filiais.

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS delivery_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS default_delivery_fee   NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (default_delivery_fee >= 0);

-- Backfill: todas as filiais ativas herdam o valor global atual.
DO $$
DECLARE
  v_enabled BOOLEAN;
  v_fee     NUMERIC(10, 2);
BEGIN
  SELECT (value#>>'{}')::boolean INTO v_enabled FROM settings WHERE key = 'delivery_enabled';
  SELECT (value#>>'{}')::numeric INTO v_fee     FROM settings WHERE key = 'default_delivery_fee';

  UPDATE branches
  SET delivery_enabled = COALESCE(v_enabled, FALSE),
      default_delivery_fee = COALESCE(v_fee, 0);
END $$;

-- Settings globais descontinuados nesta fase (dados já migrados acima).
DELETE FROM settings WHERE key IN ('delivery_enabled', 'default_delivery_fee');
