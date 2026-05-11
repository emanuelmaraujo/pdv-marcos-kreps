-- Customer retention for public checkout and operational indexes for pending app payments.

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  phone_e164 TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_order_at TIMESTAMPTZ,
  orders_count INTEGER NOT NULL DEFAULT 0,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_opt_in_at TIMESTAMPTZ,
  source order_source NOT NULL DEFAULT 'APP',
  notes TEXT
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES customers(id);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_app_awaiting_payment
  ON orders(created_at DESC)
  WHERE source = 'APP'
    AND status = 'AGUARDANDO_PAGAMENTO'
    AND payment_status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_payment_transactions_pending_pix_by_order
  ON payment_transactions(order_id, expires_at DESC, created_at DESC)
  WHERE provider = 'MERCADO_PAGO'
    AND provider_payment_method_id = 'pix'
    AND provider_status IN ('pending', 'in_process');

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe le customers" ON customers;
CREATE POLICY "Equipe le customers"
  ON customers FOR SELECT TO authenticated
  USING (get_my_role() IN ('ADMIN', 'ATTENDANT'));

DROP POLICY IF EXISTS "Admin gerencia customers" ON customers;
CREATE POLICY "Admin gerencia customers"
  ON customers FOR ALL TO authenticated
  USING (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

-- Public/order mutations for customers are intentionally handled by service-role Edge Functions.
