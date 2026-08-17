-- Migration: Delivery — Fase 3 (cadastro de entregadores)
-- Notes:
--   * Entregador é por filial (mesmo padrão operacional de packing_fee/delivery_zones).
--   * Sem login próprio nesta fase (sem profile_id) — decisão de negócio
--     "motoboy próprio vs. terceirizado" ainda em aberto; adicionar profile_id
--     depois é um ALTER TABLE simples, não precisa antecipar agora.
--   * orders.courier_id é opcional: despacho continua aceitando entregador
--     avulso digitado livremente (courier_name/courier_phone), sem obrigar
--     cadastro prévio.

CREATE TABLE IF NOT EXISTS couriers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_couriers_branch_active ON couriers(branch_id, active);

DROP TRIGGER IF EXISTS trg_couriers_updated_at ON couriers;
CREATE TRIGGER trg_couriers_updated_at
BEFORE UPDATE ON couriers
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;

-- Sem policy pública: entregador não tem app/login próprio nesta fase.
DROP POLICY IF EXISTS "Equipe le couriers" ON couriers;
CREATE POLICY "Equipe le couriers"
  ON couriers FOR SELECT TO authenticated
  USING (
    get_my_role() = 'ADMIN' OR
    branch_id IN (SELECT branch_id FROM get_my_branches())
  );

DROP POLICY IF EXISTS "Admin gerencia couriers" ON couriers;
CREATE POLICY "Admin gerencia couriers"
  ON couriers FOR ALL TO authenticated
  USING (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_id UUID REFERENCES couriers(id);
