-- Desabilita Google Pay e Apple Pay para o checkout publico no Brasil.
-- A migration anterior pode ja ter sido aplicada em algum ambiente; esta garante
-- que os metodos fiquem indisponiveis sem depender de rollback manual.

UPDATE payment_method_configs
SET
  enabled = FALSE,
  availability_reason = 'Google Pay e Apple Pay removidos do checkout publico porque nao estao disponiveis para este fluxo no Brasil.',
  provider_config = COALESCE(provider_config, '{}'::jsonb) || '{"disabled_reason": "wallets_unavailable_brazil"}'::jsonb,
  updated_at = NOW()
WHERE code IN ('GOOGLE_PAY', 'APPLE_PAY');
