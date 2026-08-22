-- Migration: Fidelidade — Fase 0 (governança)
-- Notes:
--   * Traz para o git o schema de fidelidade que já existe em produção (criado
--     fora do fluxo de migration). Todas as definições abaixo foram
--     verificadas contra o dump real de produção (supabase db dump --linked)
--     em 2026-08-19 — ver docs/plano-acao-fidelizacao.md.
--   * CREATE TABLE/TYPE usam IF NOT EXISTS: em produção isso é um no-op (as
--     tabelas já existem); em ambiente local (db reset) cria do zero.
--   * Única mudança de comportamento nesta migration: stamp_ttl_days de 90
--     para 180 dias (decisão de negócio confirmada em 2026-08-19). O resto é
--     import fiel — sem mudar lógica de acúmulo, isso é Fase 1.

DO $$ BEGIN
  CREATE TYPE loyalty_reward_status AS ENUM ('AVAILABLE', 'REDEEMED', 'EXPIRED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE loyalty_tx_kind AS ENUM ('EARN', 'REDEEM', 'EXPIRE', 'ADJUST', 'REVOKE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS loyalty_programs (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  stamps_required  INTEGER NOT NULL DEFAULT 10 CHECK (stamps_required BETWEEN 3 AND 30),
  reward_label     TEXT NOT NULL DEFAULT '1 Krep tradicional grátis',
  min_order_brl    NUMERIC(10,2) NOT NULL DEFAULT 0,
  stamp_ttl_days   INTEGER NOT NULL DEFAULT 180,
  reward_ttl_days  INTEGER NOT NULL DEFAULT 30,
  branch_scope     UUID[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  program_id        TEXT NOT NULL REFERENCES loyalty_programs(id),
  current_stamps    INTEGER NOT NULL DEFAULT 0 CHECK (current_stamps >= 0),
  lifetime_stamps   INTEGER NOT NULL DEFAULT 0,
  enrolled_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, program_id)
);

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  program_id          TEXT NOT NULL REFERENCES loyalty_programs(id),
  code                TEXT NOT NULL UNIQUE,
  label               TEXT NOT NULL,
  status              loyalty_reward_status NOT NULL DEFAULT 'AVAILABLE',
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL,
  redeemed_at         TIMESTAMPTZ,
  redeemed_order_id   UUID REFERENCES orders(id),
  redeemed_by         UUID REFERENCES profiles(id),
  redeemed_branch_id  UUID REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  kind           loyalty_tx_kind NOT NULL,
  delta          INTEGER NOT NULL,
  balance_after  INTEGER NOT NULL,
  order_id       UUID REFERENCES orders(id),
  reward_id      UUID REFERENCES loyalty_rewards(id),
  reason         TEXT,
  actor_user_id  UUID REFERENCES profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_customer
  ON loyalty_accounts(customer_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_account_status
  ON loyalty_rewards(account_id, status);

CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_expiring
  ON loyalty_rewards(expires_at) WHERE status = 'AVAILABLE';

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_account_time
  ON loyalty_transactions(account_id, created_at DESC);

-- Garante no máximo 1 crédito EARN por pedido hoje (Fase 1 vai trocar essa
-- trava para granularidade por item — ver docs/plano-acao-fidelizacao.md).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_loyalty_earn_per_order
  ON loyalty_transactions(account_id, order_id)
  WHERE kind = 'EARN' AND order_id IS NOT NULL;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_portal_token TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_portal_token_issued_at TIMESTAMPTZ;

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_loyalty_portal_token_key;
ALTER TABLE customers ADD CONSTRAINT customers_loyalty_portal_token_key UNIQUE (loyalty_portal_token);

ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Escrita direta (fora de Edge Function) só para ADMIN em loyalty_programs.
-- loyalty_accounts/rewards/transactions não têm policy de escrita para
-- authenticated — toda gravação passa por Edge Function com service_role.
DROP POLICY IF EXISTS "Admin escreve loyalty_programs" ON loyalty_programs;
CREATE POLICY "Admin escreve loyalty_programs"
  ON loyalty_programs TO authenticated
  USING (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

DROP POLICY IF EXISTS "Equipe le loyalty_programs" ON loyalty_programs;
CREATE POLICY "Equipe le loyalty_programs"
  ON loyalty_programs FOR SELECT TO authenticated
  USING (get_my_role() = ANY (ARRAY['ADMIN', 'ATTENDANT']::user_role[]));

DROP POLICY IF EXISTS "Equipe le loyalty_accounts" ON loyalty_accounts;
CREATE POLICY "Equipe le loyalty_accounts"
  ON loyalty_accounts FOR SELECT TO authenticated
  USING (get_my_role() = ANY (ARRAY['ADMIN', 'ATTENDANT']::user_role[]));

DROP POLICY IF EXISTS "Equipe le loyalty_rewards" ON loyalty_rewards;
CREATE POLICY "Equipe le loyalty_rewards"
  ON loyalty_rewards FOR SELECT TO authenticated
  USING (get_my_role() = ANY (ARRAY['ADMIN', 'ATTENDANT']::user_role[]));

DROP POLICY IF EXISTS "Equipe le loyalty_transactions" ON loyalty_transactions;
CREATE POLICY "Equipe le loyalty_transactions"
  ON loyalty_transactions FOR SELECT TO authenticated
  USING (get_my_role() = ANY (ARRAY['ADMIN', 'ATTENDANT']::user_role[]));

-- Seed idempotente do programa único ('default'). Em produção já existe com
-- stamp_ttl_days=90 — a UPDATE abaixo aplica só a mudança de 90 -> 180 dias
-- decidida em 2026-08-19, sem tocar em nenhum outro campo.
INSERT INTO loyalty_programs
  (id, name, active, stamps_required, reward_label, min_order_brl, stamp_ttl_days, reward_ttl_days, branch_scope)
VALUES
  ('default', 'Cartão Fidelidade Krep''s', TRUE, 10, '1 Krep tradicional grátis', 0, 180, 30, '{}')
ON CONFLICT (id) DO NOTHING;

UPDATE loyalty_programs
   SET stamp_ttl_days = 180
 WHERE id = 'default' AND stamp_ttl_days <> 180;

-- Settings de fidelidade — já existem em produção (data), ausentes do git.
INSERT INTO settings (key, value) VALUES
  ('loyalty_enabled', 'true'::jsonb),
  ('loyalty_public_base_url', '""'::jsonb),
  ('whatsapp_template_stamp_earned', '"fidelidade_selo"'::jsonb),
  ('whatsapp_template_reward_ready', '"fidelidade_recompensa_liberada"'::jsonb),
  ('whatsapp_template_reward_expiring', '"fidelidade_recompensa_vencendo"'::jsonb)
ON CONFLICT (key) DO NOTHING;
