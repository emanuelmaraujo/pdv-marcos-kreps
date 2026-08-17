-- Migration: Endurecimento de WebAuthn (Fase P1.3)
-- Date: 2026-08-17
-- Notes:
--   * webauthn/index.ts aceitava qualquer origem *.vercel.app como válida pra
--     ceremônia de registro/autenticação — como qualquer pessoa pode publicar
--     um app nesse domínio, isso ampliava demais o conjunto de origens
--     confiáveis. Trocado por WEBAUTHN_ALLOWED_ORIGINS (allowlist explícita
--     via env var), no código da função — esta migration só cobre a parte de
--     banco (last_used_at + auditoria).
--   * O limite de credenciais por usuário (3) já existia via trigger
--     check_webauthn_credential_limit — só corrige o SET search_path que
--     faltava (mesma classe de problema do get_my_role, corrigido em P1.1).

ALTER TABLE webauthn_credentials
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION check_webauthn_credential_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO existing_count
    FROM webauthn_credentials
   WHERE user_id = NEW.user_id;

  IF existing_count >= 3 THEN
    RAISE EXCEPTION 'Limite de 3 digitais por usuário atingido. Remova uma digital antes de adicionar outra.';
  END IF;

  RETURN NEW;
END;
$$;
