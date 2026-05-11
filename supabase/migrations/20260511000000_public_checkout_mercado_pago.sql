-- Public checkout foundation for Mercado Pago.
-- Keeps operational payments compatible with the existing PDV enums while
-- storing provider-specific details in a dedicated transaction table.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

CREATE TABLE IF NOT EXISTS payment_method_configs (
  code TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  internal_payment_method payment_method,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  requires_email BOOLEAN NOT NULL DEFAULT FALSE,
  requires_document BOOLEAN NOT NULL DEFAULT FALSE,
  requires_device_support BOOLEAN NOT NULL DEFAULT FALSE,
  availability_reason TEXT,
  provider_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('MERCADO_PAGO', 'NUPAY', 'OTHER')),
  provider_payment_id TEXT UNIQUE,
  external_reference TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  internal_payment_method payment_method,
  payment_method_code TEXT NOT NULL REFERENCES payment_method_configs(code),
  provider_payment_method_id TEXT,
  provider_payment_type_id TEXT,
  wallet_type TEXT,
  provider_status TEXT NOT NULL DEFAULT 'created',
  provider_status_detail TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  qr_code TEXT,
  qr_code_base64 TEXT,
  ticket_url TEXT,
  expires_at TIMESTAMPTZ,
  raw_provider_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_payment_id ON payment_transactions(provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(provider_status);

DROP TRIGGER IF EXISTS trg_payment_method_configs_updated_at ON payment_method_configs;
CREATE TRIGGER trg_payment_method_configs_updated_at
BEFORE UPDATE ON payment_method_configs
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER trg_payment_transactions_updated_at
BEFORE UPDATE ON payment_transactions
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE payment_method_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe le payment method configs" ON payment_method_configs;
CREATE POLICY "Equipe le payment method configs"
  ON payment_method_configs FOR SELECT TO authenticated
  USING (get_my_role() IN ('ADMIN', 'ATTENDANT'));

DROP POLICY IF EXISTS "Admin gerencia payment method configs" ON payment_method_configs;
CREATE POLICY "Admin gerencia payment method configs"
  ON payment_method_configs FOR ALL TO authenticated
  USING     (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

DROP POLICY IF EXISTS "Equipe le payment transactions" ON payment_transactions;
CREATE POLICY "Equipe le payment transactions"
  ON payment_transactions FOR SELECT TO authenticated
  USING (get_my_role() IN ('ADMIN', 'ATTENDANT'));

-- Mutations are intentionally left to service-role Edge Functions.

INSERT INTO payment_method_configs (
  code,
  provider,
  label,
  internal_payment_method,
  enabled,
  sort_order,
  requires_email,
  requires_document,
  requires_device_support,
  availability_reason,
  provider_config
) VALUES
  (
    'MERCADO_PAGO_PAYMENT_BRICK',
    'MERCADO_PAGO',
    'Mercado Pago',
    NULL,
    TRUE,
    10,
    TRUE,
    FALSE,
    FALSE,
    'Checkout transparente via Payment Brick: credito, debito disponivel, Pix e outros metodos habilitados pela conta.',
    '{"brick": "payment", "paymentMethods": {"bankTransfer": "all", "creditCard": "all", "prepaidCard": "all", "debitCard": "all"}}'::jsonb
  ),
  (
    'PIX',
    'MERCADO_PAGO',
    'Pix',
    'PIX',
    TRUE,
    20,
    TRUE,
    FALSE,
    FALSE,
    'Pix processado pelo Mercado Pago.',
    '{"brickPaymentMethod": "bankTransfer", "providerPaymentMethodId": "pix"}'::jsonb
  ),
  (
    'CREDIT_CARD',
    'MERCADO_PAGO',
    'Cartao de credito',
    'CREDIT_CARD',
    TRUE,
    30,
    TRUE,
    TRUE,
    FALSE,
    'Cartao tokenizado pelo Brick oficial do Mercado Pago.',
    '{"brickPaymentMethod": "creditCard"}'::jsonb
  ),
  (
    'DEBIT_CARD',
    'MERCADO_PAGO',
    'Cartao de debito',
    'DEBIT_CARD',
    TRUE,
    40,
    TRUE,
    TRUE,
    FALSE,
    'Disponibilidade depende dos meios liberados na conta Mercado Pago no Brasil.',
    '{"brickPaymentMethod": "debitCard"}'::jsonb
  ),
  (
    'MERCADO_PAGO_WALLET',
    'MERCADO_PAGO',
    'Conta Mercado Pago',
    NULL,
    FALSE,
    50,
    TRUE,
    FALSE,
    FALSE,
    'Preparado para Wallet Brick/preferencia Mercado Pago; ativar apos configurar preferencia e retorno.',
    '{"brick": "wallet"}'::jsonb
  ),
  (
    'GOOGLE_PAY',
    'MERCADO_PAGO',
    'Google Pay',
    'CREDIT_CARD',
    FALSE,
    60,
    TRUE,
    TRUE,
    TRUE,
    'Aguardando suporte oficial confirmado do Mercado Pago para checkout online Brasil.',
    '{"wallet": "google_pay"}'::jsonb
  ),
  (
    'APPLE_PAY',
    'MERCADO_PAGO',
    'Apple Pay',
    'CREDIT_CARD',
    FALSE,
    70,
    TRUE,
    TRUE,
    TRUE,
    'Aguardando suporte oficial confirmado do Mercado Pago para checkout online Brasil.',
    '{"wallet": "apple_pay"}'::jsonb
  ),
  (
    'NUPAY',
    'NUPAY',
    'NuPay',
    'CREDIT_CARD',
    FALSE,
    80,
    TRUE,
    TRUE,
    TRUE,
    'Reservado para fase futura, fora do Mercado Pago.',
    '{"future": true}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  provider = EXCLUDED.provider,
  label = EXCLUDED.label,
  internal_payment_method = EXCLUDED.internal_payment_method,
  sort_order = EXCLUDED.sort_order,
  requires_email = EXCLUDED.requires_email,
  requires_document = EXCLUDED.requires_document,
  requires_device_support = EXCLUDED.requires_device_support,
  availability_reason = EXCLUDED.availability_reason,
  provider_config = EXCLUDED.provider_config;
