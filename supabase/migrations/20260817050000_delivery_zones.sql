-- Migration: Delivery — Fase 2 (zonas de frete por filial)
-- Notes:
--   * Cada filial cadastra os bairros que atende e a taxa de cada um.
--   * neighborhood_normalized existe para permitir matching robusto (trim/lower/
--     sem acento) sem depender de o cliente digitar exatamente igual ao cadastro.
--   * Filial sem nenhuma zona cadastrada ainda usa branches.default_delivery_fee
--     como taxa fixa (mesmo comportamento da Fase 1) — ver supabase/functions/_shared/delivery.ts.
--     Assim que a filial cadastra ao menos uma zona, bairros fora da lista passam
--     a ser bloqueados (decisão de negócio confirmada para a Fase 2).
--   * RLS: leitura pública das zonas ativas (igual ao padrão de categories/products/
--     branches — o app público precisa mostrar a taxa antes do pagamento), gestão
--     restrita a ADMIN. O cálculo autoritativo do frete sempre roda no servidor
--     (create-attendant-order/create-public-order), nunca confia na taxa vinda do
--     cliente mesmo com a tabela sendo pública.

CREATE TABLE IF NOT EXISTS delivery_zones (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id                UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  neighborhood             TEXT NOT NULL,
  neighborhood_normalized  TEXT NOT NULL,
  fee                      NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  active                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, neighborhood_normalized)
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_branch_active
  ON delivery_zones(branch_id, active);

DROP TRIGGER IF EXISTS trg_delivery_zones_updated_at ON delivery_zones;
CREATE TRIGGER trg_delivery_zones_updated_at
BEFORE UPDATE ON delivery_zones
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active delivery_zones" ON delivery_zones;
CREATE POLICY "Public read active delivery_zones"
  ON delivery_zones FOR SELECT
  USING (
    active = TRUE AND
    branch_id IN (SELECT id FROM branches WHERE active = TRUE)
  );

DROP POLICY IF EXISTS "Admin controla delivery_zones" ON delivery_zones;
CREATE POLICY "Admin controla delivery_zones"
  ON delivery_zones FOR ALL TO authenticated
  USING (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');
