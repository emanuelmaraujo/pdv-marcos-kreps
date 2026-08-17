-- Migration: Delivery — Fase 2 (endereços reutilizáveis do cliente)
-- Notes:
--   * Mesmo padrão de opt-in de customers.remember_checkout_data: só existe
--     endereço salvo quando o cliente explicitamente marcou "salvar este
--     endereço" no checkout público.
--   * Sem policy pública de leitura/escrita — igual à tabela `customers`, todo
--     acesso público passa por Edge Function com Service Role, que resolve o
--     cliente pelo telefone (mesmo modelo de autenticação leve já usado em
--     get-public-customer-profile/create-public-order; endereço não é dado
--     financeiro nem credencial).

CREATE TABLE IF NOT EXISTS customer_addresses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label         TEXT,
  street        TEXT NOT NULL,
  number        TEXT,
  complement    TEXT,
  neighborhood  TEXT NOT NULL,
  city          TEXT,
  state         TEXT,
  postal_code   TEXT,
  reference     TEXT,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer
  ON customer_addresses(customer_id);

DROP TRIGGER IF EXISTS trg_customer_addresses_updated_at ON customer_addresses;
CREATE TRIGGER trg_customer_addresses_updated_at
BEFORE UPDATE ON customer_addresses
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

-- Equipe (ADMIN/ATTENDANT autenticados) pode ler para consultar endereço de um
-- cliente ao montar um pedido de entrega manualmente. Sem policy pública.
DROP POLICY IF EXISTS "Equipe le customer_addresses" ON customer_addresses;
CREATE POLICY "Equipe le customer_addresses"
  ON customer_addresses FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Admin gerencia customer_addresses" ON customer_addresses;
CREATE POLICY "Admin gerencia customer_addresses"
  ON customer_addresses FOR ALL TO authenticated
  USING (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');
