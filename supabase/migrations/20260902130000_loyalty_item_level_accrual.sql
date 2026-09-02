-- Migration: Fidelidade — Fase 1 (selo por item pago, não por pedido)
-- Notes:
--   * Decisão de negócio confirmada em 2026-08-20 (docs/plano-acao-fidelizacao.md):
--     um pedido com N crepes precisa dar N selos, creditados quando aquele
--     crepe é pago — não 1 selo fixo por pedido inteiro.
--   * A trava antiga (UNIQUE(account_id, order_id) WHERE kind='EARN') impedia
--     um segundo crédito no mesmo pedido — incompatível com pagamento
--     fracionado por item (mark-payment já suporta order_item_ids). Substituída
--     por uma trava por order_item_id: cada item pago só pode gerar 1 crédito,
--     não importa quantas vezes loyalty-accrue seja chamado para o pedido.
--   * loyalty_transactions.EARN passa a poder ocorrer mais de uma vez por
--     pedido (uma por chamada de mark-payment que credita itens novos), com
--     delta = soma de quantity dos itens de categoria counts_for_loyalty
--     recém-pagos naquela chamada.

DROP INDEX IF EXISTS uniq_loyalty_earn_per_order;

CREATE TABLE IF NOT EXISTS loyalty_stamp_credits (
  order_item_id  UUID PRIMARY KEY REFERENCES order_items(id) ON DELETE CASCADE,
  account_id     UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES loyalty_transactions(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE loyalty_stamp_credits IS
  'Idempotência de selo por item pago (Fase 1): 1 linha por order_item_id já creditado, nunca apagada por reprocessamento. Permite múltiplos EARN por pedido (pagamento fracionado) sem duplicar nem perder selo.';

CREATE INDEX IF NOT EXISTS idx_loyalty_stamp_credits_account
  ON loyalty_stamp_credits(account_id);

-- Marca quando um crédito foi estornado (loyalty-revoke), pra não revogar o
-- mesmo item duas vezes num pedido com múltiplos estornos parciais.
ALTER TABLE loyalty_stamp_credits ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

ALTER TABLE loyalty_stamp_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe le loyalty_stamp_credits" ON loyalty_stamp_credits;
CREATE POLICY "Equipe le loyalty_stamp_credits"
  ON loyalty_stamp_credits FOR SELECT TO authenticated
  USING (get_my_role() = ANY (ARRAY['ADMIN', 'ATTENDANT']::user_role[]));
