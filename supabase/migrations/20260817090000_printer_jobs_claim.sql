-- Migration: Claim atômico de printer_jobs (Fase P0.4)
-- Date: 2026-08-17
-- Notes:
--   * print-worker buscava jobs PENDING com um SELECT simples e processava
--     cada um. Se dois workers rodassem ao mesmo tempo (troca de máquina,
--     deploy duplicado, etc.), ambos podiam pegar o mesmo job e imprimir
--     duas vias — sem nenhum lock impedindo.
--   * Fix de drift: printed_at e error_message já eram escritos pelo
--     print-worker (jobs.ts updateJobStatus) mas nunca tinham sido criados
--     por nenhuma migration — o worker tinha um fallback silencioso que
--     descartava esses campos quando o UPDATE falhava por coluna inexistente.
--   * status continua TEXT (não virou enum) pra não quebrar código existente
--     que compara strings — só ganha um CHECK restringindo os valores válidos.

ALTER TABLE printer_jobs
  ADD COLUMN IF NOT EXISTS locked_by     TEXT,
  ADD COLUMN IF NOT EXISTS locked_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS printed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE printer_jobs DROP CONSTRAINT IF EXISTS printer_jobs_status_check;
ALTER TABLE printer_jobs ADD CONSTRAINT printer_jobs_status_check
  CHECK (status IN ('PENDING', 'PROCESSING', 'PRINTED', 'FAILED', 'SKIPPED'));

-- Índices antigos assumiam só o valor 'PENDING'; agora também precisamos
-- achar PROCESSING travado há muito tempo (lease expirado) rapidamente.
DROP INDEX IF EXISTS idx_printer_jobs_status_created_at;
CREATE INDEX IF NOT EXISTS idx_printer_jobs_claimable
  ON printer_jobs(status, created_at)
  WHERE status IN ('PENDING', 'PROCESSING');

CREATE INDEX IF NOT EXISTS idx_printer_jobs_locked_at
  ON printer_jobs(locked_at)
  WHERE status = 'PROCESSING';

-- Reivindica até p_limit jobs de forma atômica: PENDING, mais qualquer
-- PROCESSING cujo lease expirou (worker morreu no meio do print). Usa
-- FOR UPDATE SKIP LOCKED para que dois workers rodando a query ao mesmo
-- tempo nunca peguem a mesma linha — um deles simplesmente pula o que o
-- outro já está segurando.
CREATE OR REPLACE FUNCTION claim_printer_jobs(
  p_worker_id     TEXT,
  p_limit         INT DEFAULT 5,
  p_lease_seconds INT DEFAULT 120
)
RETURNS SETOF printer_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT id
      FROM printer_jobs
     WHERE status = 'PENDING'
        OR (status = 'PROCESSING' AND locked_at < NOW() - make_interval(secs => p_lease_seconds))
     ORDER BY created_at
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  )
  UPDATE printer_jobs pj
     SET status        = 'PROCESSING',
         locked_by     = p_worker_id,
         locked_at     = NOW(),
         attempt_count = COALESCE(pj.attempt_count, 0) + 1,
         updated_at    = NOW()
    FROM claimable
   WHERE pj.id = claimable.id
  RETURNING pj.*;
END;
$$;

REVOKE ALL ON FUNCTION claim_printer_jobs(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_printer_jobs(TEXT, INT, INT) TO service_role;
