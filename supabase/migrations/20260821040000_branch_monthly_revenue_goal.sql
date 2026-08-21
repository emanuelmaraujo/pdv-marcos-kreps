-- Migration: Meta mensal de faturamento por filial (relatório de caixa — Fase 4)
-- Notes:
--   * NULL = sem meta definida (o painel de ritmo no relatório fica oculto).
--   * Mesmo padrão de `branches.default_delivery_fee`: coluna simples por
--     filial, gerida em /app/configuracoes/filiais, sem tabela separada.

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS monthly_revenue_goal NUMERIC(12, 2) CHECK (monthly_revenue_goal IS NULL OR monthly_revenue_goal >= 0);
