-- Migration: Delivery — Fase 1 (enums)
-- Notes:
--   * Apenas adiciona valores aos ENUMs existentes. Não usa-os ainda — o uso
--     fica nas migrations seguintes porque Postgres proíbe usar um valor de
--     enum recém-adicionado na mesma transação que o adicionou.
--   * Aditiva. Pedidos existentes (BALCAO/VIAGEM) continuam funcionando.

ALTER TYPE order_type   ADD VALUE IF NOT EXISTS 'ENTREGA';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'SAIU_PARA_ENTREGA' BEFORE 'ENTREGUE';
