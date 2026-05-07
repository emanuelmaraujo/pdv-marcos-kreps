-- Migration: Add Product Addons table
-- Description: Vincula adicionais específicos a cada produto para evitar exibição genérica.
-- Author: Antigravity

CREATE TABLE IF NOT EXISTS product_addons (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  max_quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, addon_id)
);

-- Habilitar RLS
ALTER TABLE product_addons ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Public read product_addons" ON product_addons 
  FOR SELECT USING (true);

CREATE POLICY "Admin control product_addons" ON product_addons 
  FOR ALL TO authenticated USING (get_my_role() = 'ADMIN');

-- Garantir que os papéis tenham permissão de uso (apesar de RLS)
GRANT ALL ON TABLE product_addons TO postgres, service_role;
GRANT SELECT ON TABLE product_addons TO anon, authenticated;
