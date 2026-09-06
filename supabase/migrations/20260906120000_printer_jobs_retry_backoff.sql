-- Migration: backoff de retry na fila de impressão
-- Date: 2026-09-06
-- Notes:
--   * Bug: quando a impressora estava inalcançável, o print-worker devolvia o
--     job pra PENDING imediatamente. Como claim_printer_jobs reivindica os mais
--     antigos primeiro (ORDER BY created_at LIMIT p_limit), bastava ter p_limit
--     jobs de uma impressora offline pra que todo poll (a cada 3s) pegasse
--     sempre esses mesmos jobs mortos e nunca alcançasse os pedidos novos.
--     Numa operação multi-filial isso derruba a impressão inteira: a impressora
--     desligada de uma filial trava a fila da filial que está funcionando.
--   * Fix: next_attempt_at marca quando o job pode ser reivindicado de novo. O
--     worker preenche com backoff exponencial a cada falha; o claim passa a
--     ignorar jobs cujo horário ainda não chegou, então a fila anda.
--   * Jobs já existentes ficam com next_attempt_at NULL = elegíveis na hora,
--     que é o comportamento de hoje pra quem nunca falhou.

ALTER TABLE printer_jobs
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;

-- O índice de claim precisa cobrir next_attempt_at, senão a fila volta a fazer
-- seq scan justamente quando há muitos jobs represados.
DROP INDEX IF EXISTS idx_printer_jobs_claimable;
CREATE INDEX IF NOT EXISTS idx_printer_jobs_claimable
  ON printer_jobs(status, next_attempt_at, created_at)
  WHERE status IN ('PENDING', 'PROCESSING');

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
     WHERE (
             status = 'PENDING'
             AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
           )
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
