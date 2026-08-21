-- O print-worker (Raspberry Pi) escreve seu heartbeat direto na tabela
-- settings a cada ~15s (print_worker_last_seen_at, print_worker_status,
-- print_worker_ip, print_worker_hostname, print_worker_platform,
-- print_worker_printer_host, print_worker_printer_port). O trigger de
-- auditoria da migration 20260821050000 loga corretamente toda mudança de
-- valor real — mas um heartbeat muda de valor a cada batida por definição,
-- então isso gera ~5.700 linhas/dia em audit_logs só de telemetria de
-- máquina, sem nenhum valor de auditoria (não é uma decisão humana).
-- Exclui explicitamente essas chaves do trigger; toda mudança feita por um
-- admin pela tela de Configurações continua sendo logada normalmente.
CREATE OR REPLACE FUNCTION log_settings_audit_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.key LIKE 'print_worker_%' THEN RETURN NEW; END IF;
    INSERT INTO audit_logs (user_id, action, table_name, new_data)
    VALUES (auth.uid(), 'SETTING_CREATED', 'settings', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.key LIKE 'print_worker_%' THEN RETURN NEW; END IF;
    IF to_jsonb(OLD.value) IS NOT DISTINCT FROM to_jsonb(NEW.value) THEN
      RETURN NEW; -- upsert repetiu o mesmo valor (ex: save sem alterações) — não loga ruído
    END IF;
    INSERT INTO audit_logs (user_id, action, table_name, old_data, new_data)
    VALUES (auth.uid(), 'SETTING_UPDATED', 'settings', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.key LIKE 'print_worker_%' THEN RETURN OLD; END IF;
    INSERT INTO audit_logs (user_id, action, table_name, old_data)
    VALUES (auth.uid(), 'SETTING_DELETED', 'settings', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
