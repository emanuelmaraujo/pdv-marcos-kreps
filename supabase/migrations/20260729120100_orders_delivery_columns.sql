-- Migration: Delivery — Fase 1 (colunas em orders + settings)
-- MVP interno: endereço como campos soltos na order (sem tabela reutilizável
-- ainda) e courier como texto livre preenchido pelo atendente (sem tabela
-- couriers ainda). Ambos evoluem em fases futuras.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_street TEXT,
  ADD COLUMN IF NOT EXISTS delivery_number TEXT,
  ADD COLUMN IF NOT EXISTS delivery_complement TEXT,
  ADD COLUMN IF NOT EXISTS delivery_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS delivery_city TEXT,
  ADD COLUMN IF NOT EXISTS delivery_state TEXT,
  ADD COLUMN IF NOT EXISTS delivery_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS delivery_reference TEXT,
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courier_name TEXT,
  ADD COLUMN IF NOT EXISTS courier_phone TEXT,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_type_status
  ON orders(branch_id, type, status)
  WHERE type = 'ENTREGA';

INSERT INTO settings (key, value)
VALUES
  ('delivery_enabled', 'false'::jsonb),
  ('default_delivery_fee', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;
