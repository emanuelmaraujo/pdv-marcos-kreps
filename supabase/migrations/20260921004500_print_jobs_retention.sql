-- Retenção operacional da fila de impressão.
-- O histórico de printer_jobs não é dado de negócio; pedidos/pagamentos
-- permanecem nas respectivas tabelas. Mantemos apenas janela curta para
-- diagnóstico recente e evitamos crescimento indefinido.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-printer-jobs'
  ) THEN
    PERFORM cron.schedule(
      'cleanup-printer-jobs',
      '17 4 * * *',
      $job$
        DELETE FROM public.printer_jobs
        WHERE status IN ('PRINTED','FAILED','SKIPPED')
          AND created_at < now() - interval '2 days';
      $job$
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-cron-history'
  ) THEN
    PERFORM cron.schedule(
      'cleanup-cron-history',
      '37 4 * * *',
      $job$
        DELETE FROM cron.job_run_details
        WHERE start_time < now() - interval '7 days';
      $job$
    );
  END IF;
END
$$;
