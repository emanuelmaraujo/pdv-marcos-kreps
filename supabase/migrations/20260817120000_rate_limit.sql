-- Migration: Rate limit por janela deslizante (Fase P1.2)
-- Date: 2026-08-17
-- Notes:
--   * lookup-orders-by-phone não tinha nenhum throttling — um script podia
--     tentar telefones em sequência sem limite, procurando pedidos ativos
--     (e o public_token que dá acesso ao acompanhamento deles).
--   * Implementação simples de propósito: tabela + RPC com janela deslizante
--     baseada em contagem de linhas. Não é hiper-precisa nem otimizada pra
--     altíssimo volume, mas resolve o problema real (throttle por telefone
--     normalizado e por IP) sem introduzir dependência externa (Redis etc).

CREATE TABLE IF NOT EXISTS rate_limit_hits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_key_created_at
  ON rate_limit_hits(key, created_at);

ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy criada de propósito: só service_role (que ignora RLS) mexe
-- nesta tabela, via check_rate_limit. authenticated/anon não têm acesso algum.

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key            TEXT,
  p_max_hits       INT,
  p_window_seconds INT DEFAULT 900
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Limpa hits antigos desta key — mantém a tabela pequena sem precisar de cron.
  DELETE FROM rate_limit_hits
   WHERE key = p_key AND created_at < NOW() - make_interval(secs => p_window_seconds);

  SELECT COUNT(*) INTO v_count
    FROM rate_limit_hits
   WHERE key = p_key AND created_at >= NOW() - make_interval(secs => p_window_seconds);

  IF v_count >= p_max_hits THEN
    RETURN FALSE;
  END IF;

  INSERT INTO rate_limit_hits (key) VALUES (p_key);
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION check_rate_limit(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, INT, INT) TO service_role;
