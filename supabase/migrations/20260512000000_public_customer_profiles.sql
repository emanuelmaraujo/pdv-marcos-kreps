-- Public checkout profile retention. Profiles are only returned to the
-- public checkout when the customer explicitly allowed the store to remember
-- checkout data for future orders.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS remember_checkout_data BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_order_type order_type,
  ADD COLUMN IF NOT EXISTS checkout_profile_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customers_public_profile_lookup
  ON customers(phone_e164)
  WHERE remember_checkout_data = TRUE;
