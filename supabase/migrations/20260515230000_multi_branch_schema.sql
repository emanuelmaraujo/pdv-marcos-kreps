-- Migration: Multi-filial — Phase 0A (schema)
-- Date: 2026-05-15
-- Notes:
--   * Adiciona suporte a múltiplas filiais (lojas + pop-ups + feiras).
--   * Cardápio totalmente separado por filial (products, categories, ingredients, addons).
--   * Pedidos, caixa, impressão e audit isolados por filial.
--   * WhatsApp e Mercado Pago/PIX permanecem globais (mesma conta).
--   * Atendentes podem operar múltiplas filiais via tabela profile_branches.
--   * branch_id é NULLABLE nesta migration. A migration 0B faz o backfill e
--     promove a NOT NULL onde fizer sentido.
--   * Aditiva: nenhum DROP destrutivo de dados.

-- ============================================================================
-- 1. Enum de tipo de filial
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'branch_type') THEN
    CREATE TYPE branch_type AS ENUM ('STORE', 'POPUP', 'FAIR');
  END IF;
END$$;

-- ============================================================================
-- 2. Tabela branches
-- ============================================================================
CREATE TABLE IF NOT EXISTS branches (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- "code" é o prefixo curto exibido nos pedidos: P-42, F-12.
  code         TEXT         NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{1,3}$'),
  -- "slug" entra na URL pública de pedido: /pedir/principal, /pedir/feira.
  slug         TEXT         NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,32}$'),
  name         TEXT         NOT NULL,
  type         branch_type  NOT NULL DEFAULT 'STORE',
  active       BOOLEAN      NOT NULL DEFAULT TRUE,
  address      TEXT,
  phone        TEXT,

  -- Configurações operacionais por filial.
  printer_config           JSONB         NOT NULL DEFAULT '{}'::jsonb,
  packing_fee              NUMERIC(10,2) NOT NULL DEFAULT 0,
  ordering_enabled         BOOLEAN       NOT NULL DEFAULT TRUE,
  ordering_start_time      TEXT,    -- HH:MM, NULL = usa global
  ordering_end_time        TEXT,    -- HH:MM, NULL = usa global

  -- WhatsApp: número/conta é global, mas a filial pode ligar/desligar e
  -- customizar templates. whatsapp_templates é um mapa event_type ->
  -- { template_name, language?, enabled? }. Ex.:
  --   {
  --     "order_received":      { "template_name": "novo_pedido_principal", "language": "pt_BR" },
  --     "order_partial_ready": { "enabled": false },
  --     "order_ready":         { "template_name": "pedido_pronto_principal", "language": "pt_BR" }
  --   }
  -- Quando whatsapp_templates é {}, o sistema usa os templates globais default.
  whatsapp_enabled         BOOLEAN       NOT NULL DEFAULT TRUE,
  whatsapp_templates       JSONB         NOT NULL DEFAULT '{}'::jsonb,

  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branches_active_slug ON branches(active, slug);

DROP TRIGGER IF EXISTS trg_branches_updated_at ON branches;
CREATE TRIGGER trg_branches_updated_at
BEFORE UPDATE ON branches
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================================
-- 3. profile_branches — vínculo N:N entre atendentes e filiais
--    ADMIN tem acesso a todas mesmo sem linha aqui (ver get_my_branches).
-- ============================================================================
CREATE TABLE IF NOT EXISTS profile_branches (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, branch_id)
);

-- Filial "preferida" / inicial após login (atendentes multi-filial entram nela).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS home_branch_id UUID REFERENCES branches(id);

-- ============================================================================
-- 4. branch_id em tabelas de cardápio (CARDÁPIO SEPARADO POR FILIAL)
-- ============================================================================
ALTER TABLE categories  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE products    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE addons      ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

CREATE INDEX IF NOT EXISTS idx_categories_branch  ON categories(branch_id, active, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_branch    ON products(branch_id, active);
CREATE INDEX IF NOT EXISTS idx_ingredients_branch ON ingredients(branch_id, active);
CREATE INDEX IF NOT EXISTS idx_addons_branch      ON addons(branch_id, active);

-- ============================================================================
-- 5. branch_id em tabelas operacionais
-- ============================================================================
ALTER TABLE orders             ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE cash_sessions      ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE printer_jobs       ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE whatsapp_messages  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE audit_logs         ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

CREATE INDEX IF NOT EXISTS idx_orders_branch_created    ON orders(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_branch     ON cash_sessions(branch_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_printer_jobs_branch      ON printer_jobs(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_branch ON whatsapp_messages(branch_id, status);

-- ============================================================================
-- 6. Função helper: filiais que o usuário corrente pode operar
--    ADMIN -> todas as filiais ativas.
--    ATTENDANT -> só as listadas em profile_branches.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_my_branches()
RETURNS TABLE(branch_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM branches WHERE active = TRUE AND get_my_role() = 'ADMIN'
  UNION
  SELECT pb.branch_id
    FROM profile_branches pb
    JOIN branches b ON b.id = pb.branch_id AND b.active = TRUE
   WHERE pb.profile_id = auth.uid();
$$;

-- ============================================================================
-- 7. RLS: branches e profile_branches
-- ============================================================================
ALTER TABLE branches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active branches"        ON branches;
DROP POLICY IF EXISTS "Equipe le filiais autorizadas"      ON branches;
DROP POLICY IF EXISTS "Admin controla branches"            ON branches;

-- Anônimos podem listar filiais ativas (necessário para /pedir/[slug]).
CREATE POLICY "Public read active branches"
  ON branches FOR SELECT USING (active = TRUE);

CREATE POLICY "Admin controla branches"
  ON branches FOR ALL TO authenticated
  USING (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

DROP POLICY IF EXISTS "Admin controla profile_branches" ON profile_branches;
DROP POLICY IF EXISTS "Profile le seus vinculos"        ON profile_branches;

CREATE POLICY "Admin controla profile_branches"
  ON profile_branches FOR ALL TO authenticated
  USING (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

CREATE POLICY "Profile le seus vinculos"
  ON profile_branches FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- ============================================================================
-- 8. Recriar policies das tabelas operacionais para filtrar por get_my_branches()
--    O acesso a um pedido/produto/etc passa a depender de o usuário operar a filial.
--    ADMIN continua vendo tudo (get_my_branches retorna todas as ativas para ADMIN).
-- ============================================================================

-- Cardápio: leitura pública por filial ativa; gestão restrita a ADMIN.
DROP POLICY IF EXISTS "Public read active categories"  ON categories;
DROP POLICY IF EXISTS "Public read active products"    ON products;
DROP POLICY IF EXISTS "Public read active ingredients" ON ingredients;
DROP POLICY IF EXISTS "Public read active addons"      ON addons;

CREATE POLICY "Public read active categories" ON categories FOR SELECT
USING (active = TRUE AND (
  branch_id IS NULL OR
  branch_id IN (SELECT id FROM branches WHERE active = TRUE)
));

CREATE POLICY "Public read active products" ON products FOR SELECT
USING (active = TRUE AND (
  branch_id IS NULL OR
  branch_id IN (SELECT id FROM branches WHERE active = TRUE)
));

CREATE POLICY "Public read active ingredients" ON ingredients FOR SELECT
USING (active = TRUE AND (
  branch_id IS NULL OR
  branch_id IN (SELECT id FROM branches WHERE active = TRUE)
));

CREATE POLICY "Public read active addons" ON addons FOR SELECT
USING (active = TRUE AND (
  branch_id IS NULL OR
  branch_id IN (SELECT id FROM branches WHERE active = TRUE)
));

-- Pedidos e operacionais: ADMIN ou filial autorizada.
DROP POLICY IF EXISTS "Equipe gerencia pedidos"           ON orders;
CREATE POLICY "Equipe gerencia pedidos" ON orders FOR ALL TO authenticated
USING (
  get_my_role() = 'ADMIN' OR
  branch_id IS NULL OR  -- pedidos legados (pré-multi-filial) — visíveis até o backfill
  branch_id IN (SELECT branch_id FROM get_my_branches())
)
WITH CHECK (
  get_my_role() = 'ADMIN' OR
  branch_id IN (SELECT branch_id FROM get_my_branches())
);

DROP POLICY IF EXISTS "Equipe gerencia itens de pedido" ON order_items;
CREATE POLICY "Equipe gerencia itens de pedido" ON order_items FOR ALL TO authenticated
USING (
  get_my_role() = 'ADMIN' OR
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
      AND (o.branch_id IS NULL OR o.branch_id IN (SELECT branch_id FROM get_my_branches()))
  )
);

DROP POLICY IF EXISTS "Equipe gerencia removidos" ON order_item_removed_ingredients;
CREATE POLICY "Equipe gerencia removidos" ON order_item_removed_ingredients FOR ALL TO authenticated
USING (
  get_my_role() = 'ADMIN' OR
  EXISTS (
    SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE oi.id = order_item_removed_ingredients.order_item_id
      AND (o.branch_id IS NULL OR o.branch_id IN (SELECT branch_id FROM get_my_branches()))
  )
);

DROP POLICY IF EXISTS "Equipe gerencia addons do item" ON order_item_addons;
CREATE POLICY "Equipe gerencia addons do item" ON order_item_addons FOR ALL TO authenticated
USING (
  get_my_role() = 'ADMIN' OR
  EXISTS (
    SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE oi.id = order_item_addons.order_item_id
      AND (o.branch_id IS NULL OR o.branch_id IN (SELECT branch_id FROM get_my_branches()))
  )
);

DROP POLICY IF EXISTS "Equipe gerencia caixas" ON cash_sessions;
CREATE POLICY "Equipe gerencia caixas" ON cash_sessions FOR ALL TO authenticated
USING (
  get_my_role() = 'ADMIN' OR
  branch_id IS NULL OR
  branch_id IN (SELECT branch_id FROM get_my_branches())
)
WITH CHECK (
  get_my_role() = 'ADMIN' OR
  branch_id IN (SELECT branch_id FROM get_my_branches())
);

DROP POLICY IF EXISTS "Equipe gerencia pagamentos" ON payments;
CREATE POLICY "Equipe gerencia pagamentos" ON payments FOR ALL TO authenticated
USING (
  get_my_role() = 'ADMIN' OR
  EXISTS (
    SELECT 1 FROM orders o WHERE o.id = payments.order_id
      AND (o.branch_id IS NULL OR o.branch_id IN (SELECT branch_id FROM get_my_branches()))
  )
);

DROP POLICY IF EXISTS "Equipe gerencia descontos" ON discounts;
CREATE POLICY "Equipe gerencia descontos" ON discounts FOR ALL TO authenticated
USING (
  get_my_role() = 'ADMIN' OR
  EXISTS (
    SELECT 1 FROM orders o WHERE o.id = discounts.order_id
      AND (o.branch_id IS NULL OR o.branch_id IN (SELECT branch_id FROM get_my_branches()))
  )
);

DROP POLICY IF EXISTS "Equipe gerencia printer_jobs" ON printer_jobs;
CREATE POLICY "Equipe gerencia printer_jobs" ON printer_jobs FOR ALL TO authenticated
USING (
  get_my_role() = 'ADMIN' OR
  branch_id IS NULL OR
  branch_id IN (SELECT branch_id FROM get_my_branches())
);

DROP POLICY IF EXISTS "Equipe gerencia whatsapp_messages" ON whatsapp_messages;
CREATE POLICY "Equipe gerencia whatsapp_messages" ON whatsapp_messages FOR ALL TO authenticated
USING (
  get_my_role() = 'ADMIN' OR
  branch_id IS NULL OR
  branch_id IN (SELECT branch_id FROM get_my_branches())
);
