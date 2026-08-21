-- Trilha de auditoria para branches e settings.
--
-- Usuários já são auditados manualmente pela Edge Function manage-users
-- (audit_logs.action IN USER_CREATED/USER_UPDATED/...). branches e settings,
-- porém, são atualizados direto do client autenticado (RLS "Apenas Admin"),
-- sem nenhum registro de quem mudou o quê — risco real numa operação
-- multi-filial. Este arquivo fecha esse gap via trigger, sem exigir que cada
-- chamador (hoje ou futuro) se lembre de logar manualmente.

-- ==========================================
-- 1. branches — tem PK uuid `id`, então registra a linha inteira antes/depois.
-- ==========================================
CREATE OR REPLACE FUNCTION log_branch_audit_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, new_data)
    VALUES (auth.uid(), 'BRANCH_CREATED', 'branches', NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), 'BRANCH_UPDATED', 'branches', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data)
    VALUES (auth.uid(), 'BRANCH_DELETED', 'branches', OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_branches_audit ON branches;
CREATE TRIGGER trg_branches_audit
  AFTER INSERT OR UPDATE OR DELETE ON branches
  FOR EACH ROW EXECUTE FUNCTION log_branch_audit_change();

-- ==========================================
-- 2. settings — PK é `key` (TEXT), não uuid. audit_logs.record_id é uuid,
--    então aqui fica NULL e a chave viaja dentro de new_data/old_data.
-- ==========================================
CREATE OR REPLACE FUNCTION log_settings_audit_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, table_name, new_data)
    VALUES (auth.uid(), 'SETTING_CREATED', 'settings', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF to_jsonb(OLD.value) IS NOT DISTINCT FROM to_jsonb(NEW.value) THEN
      RETURN NEW; -- upsert repetiu o mesmo valor (ex: save sem alterações) — não loga ruído
    END IF;
    INSERT INTO audit_logs (user_id, action, table_name, old_data, new_data)
    VALUES (auth.uid(), 'SETTING_UPDATED', 'settings', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, table_name, old_data)
    VALUES (auth.uid(), 'SETTING_DELETED', 'settings', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_settings_audit ON settings;
CREATE TRIGGER trg_settings_audit
  AFTER INSERT OR UPDATE OR DELETE ON settings
  FOR EACH ROW EXECUTE FUNCTION log_settings_audit_change();

-- Índice de apoio para a tela de histórico (Fase 2/3 do redesenho) filtrar
-- por entidade rapidamente.
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record
  ON audit_logs (table_name, record_id, created_at DESC);
