ALTER TYPE order_source ADD VALUE IF NOT EXISTS 'APP';

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read settings" ON settings;
CREATE POLICY "Public read settings"
  ON settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin control settings" ON settings;
CREATE POLICY "Admin control settings"
  ON settings FOR ALL TO authenticated
  USING (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

INSERT INTO settings (key, value)
VALUES
  ('public_ordering_enabled', 'true'::jsonb),
  ('public_ordering_start_time', '"17:00"'::jsonb),
  ('public_ordering_end_time', '"23:30"'::jsonb),
  ('packaging_fee', '0'::jsonb),
  ('apply_packaging_fee_for_takeout', 'false'::jsonb),
  ('printing_enabled', 'true'::jsonb),
  ('print_customer_copy', 'true'::jsonb),
  ('print_kitchen_copy', 'true'::jsonb),
  ('print_juice_potato_copy', 'true'::jsonb),
  ('whatsapp_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
