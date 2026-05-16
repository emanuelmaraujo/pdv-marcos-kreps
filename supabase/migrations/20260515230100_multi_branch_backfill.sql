-- Migration: Multi-filial — Phase 0B (backfill + daily_number por filial)
-- Date: 2026-05-15
-- Notes:
--   * Cria a filial padrão "Loja Principal" (code='P', slug='principal').
--   * Faz backfill de todas as tabelas existentes apontando para essa filial.
--   * Promove branch_id a NOT NULL onde fizer sentido (cardápio + operacionais).
--   * Refatora get_next_daily_order_number() para gerar por filial.
--   * Idempotente (usa ON CONFLICT / WHERE NULL).

-- ============================================================================
-- 1. Cria a Loja Principal e popula com defaults vindos das settings globais.
-- ============================================================================
INSERT INTO branches (code, slug, name, type, active, packing_fee, ordering_enabled)
SELECT
  'P', 'principal', 'Loja Principal', 'STORE', TRUE,
  COALESCE((SELECT (value)::text::numeric FROM settings WHERE key = 'packing_fee'), 0),
  COALESCE((SELECT (value)::text::boolean FROM settings WHERE key = 'public_ordering_enabled'), TRUE)
ON CONFLICT (code) DO NOTHING;

-- Captura o id num bloco DO para reutilizar nos UPDATEs.
DO $$
DECLARE
  v_main_branch UUID;
BEGIN
  SELECT id INTO v_main_branch FROM branches WHERE code = 'P';

  -- Backfill cardápio
  UPDATE categories  SET branch_id = v_main_branch WHERE branch_id IS NULL;
  UPDATE products    SET branch_id = v_main_branch WHERE branch_id IS NULL;
  UPDATE ingredients SET branch_id = v_main_branch WHERE branch_id IS NULL;
  UPDATE addons      SET branch_id = v_main_branch WHERE branch_id IS NULL;

  -- Backfill operacionais
  UPDATE orders            SET branch_id = v_main_branch WHERE branch_id IS NULL;
  UPDATE cash_sessions     SET branch_id = v_main_branch WHERE branch_id IS NULL;
  UPDATE printer_jobs      SET branch_id = v_main_branch WHERE branch_id IS NULL;
  UPDATE whatsapp_messages SET branch_id = v_main_branch WHERE branch_id IS NULL;
  UPDATE audit_logs        SET branch_id = v_main_branch WHERE branch_id IS NULL;

  -- Vincula todos os profiles existentes à Loja Principal e define como home.
  INSERT INTO profile_branches (profile_id, branch_id)
  SELECT id, v_main_branch FROM profiles
  ON CONFLICT DO NOTHING;

  UPDATE profiles SET home_branch_id = v_main_branch WHERE home_branch_id IS NULL;
END$$;

-- ============================================================================
-- 2. NOT NULL onde a regra é estrita.
--    Mantemos audit_logs.branch_id NULLABLE (logs históricos podem não ter filial).
-- ============================================================================
ALTER TABLE categories      ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE products        ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE ingredients     ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE addons          ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE orders          ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE cash_sessions   ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE printer_jobs    ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE whatsapp_messages ALTER COLUMN branch_id SET NOT NULL;

-- ============================================================================
-- 3. Daily_number agora é por filial (cada filial conta do 1 todo dia).
--    Mantém a função antiga assinada para compatibilidade caso algo legado chame.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_next_daily_order_number_for_branch(p_branch_id UUID)
RETURNS INTEGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required to allocate daily order number';
  END IF;

  -- Lock por filial: serializa apenas inserts da MESMA filial. Filiais diferentes não esperam.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('daily_order_seq:' || p_branch_id::text, 0)
  );

  SELECT COALESCE(MAX(daily_number), 0) + 1 INTO next_num
  FROM orders
  WHERE branch_id = p_branch_id
    AND date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo')
      = date_trunc('day', NOW()        AT TIME ZONE 'America/Sao_Paulo');

  RETURN next_num;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Mantém a antiga como wrapper retro-compatível: usa a Loja Principal por default.
-- (Edge functions devem migrar para a versão _for_branch ao popular branch_id.)
CREATE OR REPLACE FUNCTION get_next_daily_order_number()
RETURNS INTEGER AS $$
DECLARE
  v_default_branch UUID;
BEGIN
  SELECT id INTO v_default_branch FROM branches WHERE code = 'P' LIMIT 1;
  RETURN get_next_daily_order_number_for_branch(v_default_branch);
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Trigger que popula daily_number passa a usar branch_id do próprio pedido.
CREATE OR REPLACE FUNCTION set_daily_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.daily_number IS NULL THEN
    IF NEW.branch_id IS NULL THEN
      RAISE EXCEPTION 'orders.branch_id must be set before assigning daily_number';
    END IF;
    NEW.daily_number := get_next_daily_order_number_for_branch(NEW.branch_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- (O trigger trg_set_daily_order_number já está criado; não precisa recriar —
-- ele referencia set_daily_order_number() pelo nome e pega a nova versão.)
