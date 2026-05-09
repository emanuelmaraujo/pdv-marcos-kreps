-- Performance indexes missing from initial schema
-- Created: 2026-05-09

-- Orders: frequent filter by status + date for the active-orders board
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
  ON orders (status, created_at DESC);

-- Orders: Sao Paulo-aware daily boundary query (used by getTodayOrders)
CREATE INDEX IF NOT EXISTS idx_orders_created_at_tz
  ON orders (created_at DESC);

-- Printer jobs: order-level look-ups (e.g. "has this order been printed?")
CREATE INDEX IF NOT EXISTS idx_printer_jobs_order_id
  ON printer_jobs (order_id);

-- Printer jobs: composite covering index for queue processing
CREATE INDEX IF NOT EXISTS idx_printer_jobs_status_created_at
  ON printer_jobs (status, created_at)
  WHERE status = 'PENDING';

-- WhatsApp: order-level look-ups
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_order_id
  ON whatsapp_messages (order_id);

-- Order items: navigate from item → order
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items (order_id);

-- Order item addons / removed ingredients: navigate from child → item
CREATE INDEX IF NOT EXISTS idx_order_item_addons_order_item_id
  ON order_item_addons (order_item_id);

CREATE INDEX IF NOT EXISTS idx_order_item_removed_ingredients_order_item_id
  ON order_item_removed_ingredients (order_item_id);

-- Profiles: role-based queries (get_my_role is SECURITY DEFINER but still benefits)
CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON profiles (role)
  WHERE active = true;

-- WebAuthn: look up credentials by user_id (complement to the unique credential_id idx)
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id
  ON webauthn_credentials (user_id);
