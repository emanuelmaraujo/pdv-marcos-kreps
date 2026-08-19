-- Migration: Validação de endereço por CEP — formato do postal_code
-- Notes:
--   * Endereços novos (checkout público e atendente) passam a exigir CEP,
--     revalidado no servidor contra o ViaCEP antes de gravar o pedido.
--   * Endereços salvos antigos sem CEP continuam válidos como estão —
--     por isso a constraint permite NULL, só valida o formato quando presente.

ALTER TABLE customer_addresses
  ADD CONSTRAINT chk_customer_addresses_postal_code_format
  CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{8}$');
