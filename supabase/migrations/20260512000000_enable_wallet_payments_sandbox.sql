-- Habilita Google Pay e Apple Pay em sandbox.
-- Producao requer:
--   1. Apple Pay: validacao de dominio HTTPS junto ao Mercado Pago (arquivo apple-developer-merchantid-domain-association).
--   2. Google Pay: confirmacao de suporte na conta Mercado Pago Brasil.
-- Consultar MCP Mercado Pago e DevPanel antes de habilitar em producao.

UPDATE payment_method_configs
SET
  enabled = TRUE,
  availability_reason = 'Habilitado em sandbox. Producao requer validacao de dominio Apple Pay e suporte confirmado na conta Mercado Pago Brasil.',
  provider_config = provider_config || '{"sandbox_only": true}'::jsonb,
  updated_at = NOW()
WHERE code IN ('GOOGLE_PAY', 'APPLE_PAY');
